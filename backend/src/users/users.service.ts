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

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('Kullanici bulunamadi.');
    return this.flatten(user);
  }

  async approve(id: string, dto: ApproveUserDto, approverId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Kullanici bulunamadi.');
    if (user.status === 'VERIFIED') {
      throw new BadRequestException('Kullanici zaten onayli.');
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
      title: 'Hesabiniz onaylandi',
      message:
        'Hesabiniz yonetici tarafindan onaylandi. Artik bildirim yapabilirsiniz.',
    });

    return this.findOne(id);
  }

  async reject(id: string, dto: RejectUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Kullanici bulunamadi.');
    if (user.isSuperAdmin) {
      throw new BadRequestException('Super admin reddedilemez.');
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await this.notifications.create({
      userId: id,
      type: 'ACCOUNT_REJECTED',
      title: 'Hesap kaydiniz reddedildi',
      message: dto.reason
        ? `Kaydiniz reddedildi. Sebep: ${dto.reason}`
        : 'Hesap kaydiniz yonetici tarafindan reddedildi.',
    });

    return { ok: true };
  }

  async updateAuthorization(id: string, dto: UpdateUserAuthorizationDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Kullanici bulunamadi.');
    if (user.isSuperAdmin) {
      throw new BadRequestException(
        'Super admin yetkileri degistirilemez.',
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
      title: 'Yetkileriniz guncellendi',
      message: 'Yonetici rol, rutbe veya birim atamanizi guncelledi.',
    });

    return this.findOne(id);
  }

  async setStatus(id: string, status: 'SUSPENDED' | 'VERIFIED') {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Kullanici bulunamadi.');
    if (user.isSuperAdmin) {
      throw new BadRequestException('Super admin durumu degistirilemez.');
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
