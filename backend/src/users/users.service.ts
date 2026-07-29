import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ApproveUserDto,
  RejectUserDto,
  UpdateUserAuthorizationDto,
} from './dto/user.dto';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
  rank: true,
  isSuperAdmin: true,
  createdAt: true,
  verifiedAt: true,
  role: { select: { id: true, name: true, permissions: true } },
  departments: {
    select: { department: { select: { id: true, name: true } } },
  },
};

// Atama ekranlari icin dar gorunum. Veri minimizasyonu: email, phone,
// passwordHash, status, izin listesi ve denetim alanlari sorguya hic
// dahil edilmez; boylece response'a kazara sizamaz.
const assignableSelect = {
  id: true,
  firstName: true,
  lastName: true,
  rank: true,
  role: { select: { id: true, name: true } },
  departments: {
    select: { department: { select: { id: true, name: true } } },
  },
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(status?: string) {
    const users = await this.prisma.user.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });
    return users.map(this.flatten);
  }

  // Bildirim / duzeltici faaliyet atamalarinda secilebilecek kullanicilar.
  // Yalnizca VERIFIED hesaplar doner; PENDING, REJECTED ve SUSPENDED
  // hesaplar atanabilir degildir. (Semada ayrica bir aktiflik alani yok.)
  // Super admin teknik bir hesaptir; atama listesine girmez.
  async findAssignable() {
    const users = await this.prisma.user.findMany({
      where: { status: 'VERIFIED', isSuperAdmin: false },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: assignableSelect,
    });

    return users.map((u) => ({
      ...u,
      departments: u.departments.map((d) => d.department),
    }));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    return this.flatten(user);
  }

  async approve(id: string, dto: ApproveUserDto, approverId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (user.status === 'VERIFIED') {
      // Ayni hesap ikinci kez onaylanamaz
      throw new BadRequestException(
        'Bu kullanıcı hesabı zaten onaylanmış.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: approverId,
          roleId: dto.roleId ?? undefined,
          rank: dto.rank ?? undefined,
        },
      });

      if (dto.departmentIds) {
        await tx.userDepartment.deleteMany({ where: { userId: id } });
        if (dto.departmentIds.length > 0) {
          await tx.userDepartment.createMany({
            data: dto.departmentIds.map((departmentId) => ({
              userId: id,
              departmentId,
            })),
          });
        }
      }
    });

    await this.notifications.create({
      userId: id,
      type: 'ACCOUNT_APPROVED',
      title: 'Hesabınız onaylandı',
      message:
        'Hesabınız yönetici tarafından onaylandı. Artık bildirim yapabilirsiniz.',
    });

    // Onayculardaki "onay bekliyor" bildirimleri tamamlandi say
    await this.notifications.resolveAccountApproval(id);

    return this.findOne(id);
  }

  async reject(id: string, dto: RejectUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (user.isSuperAdmin) {
      throw new BadRequestException('Süper admin reddedilemez.');
    }
    if (user.status === 'REJECTED') {
      throw new BadRequestException(
        'Bu kullanıcı hesabı zaten reddedilmiş.',
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await this.notifications.create({
      userId: id,
      type: 'ACCOUNT_REJECTED',
      title: 'Hesap kaydınız reddedildi',
      message: dto.reason
        ? `Kaydınız reddedildi. Sebep: ${dto.reason}`
        : 'Hesap kaydınız yönetici tarafından reddedildi.',
    });

    await this.notifications.resolveAccountApproval(id);

    return { ok: true };
  }

  async updateAuthorization(id: string, dto: UpdateUserAuthorizationDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (user.isSuperAdmin) {
      throw new BadRequestException(
        'Süper admin yetkileri değiştirilemez.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          roleId: dto.roleId === undefined ? undefined : dto.roleId,
          rank: dto.rank === undefined ? undefined : dto.rank,
        },
      });

      if (dto.departmentIds) {
        await tx.userDepartment.deleteMany({ where: { userId: id } });
        if (dto.departmentIds.length > 0) {
          await tx.userDepartment.createMany({
            data: dto.departmentIds.map((departmentId) => ({
              userId: id,
              departmentId,
            })),
          });
        }
      }
    });

    await this.notifications.create({
      userId: id,
      type: 'ROLE_ASSIGNED',
      title: 'Yetkileriniz güncellendi',
      message: 'Yönetici rol, rütbe veya birim atamanızı güncelledi.',
    });

    return this.findOne(id);
  }

  async setStatus(id: string, status: 'SUSPENDED' | 'VERIFIED') {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (user.isSuperAdmin) {
      throw new BadRequestException('Süper admin durumu değiştirilemez.');
    }
    await this.prisma.user.update({ where: { id }, data: { status } });
    return this.findOne(id);
  }

  private flatten(user: any) {
    return {
      ...user,
      departments: user.departments.map((d: any) => d.department),
    };
  }
}
