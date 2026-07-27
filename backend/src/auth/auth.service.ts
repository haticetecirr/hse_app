import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Bu e-posta ile bir hesap zaten var.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: 'PENDING', // Kayit sonrasi admin onayi bekler
      },
    });

    // Yeni kayit -> onay yetkisi olan kullanicilara bildirim
    await this.notifyApprovers(user.id, `${user.firstName} ${user.lastName}`);

    await this.audit.log({
      actor: { id: user.id, name: user.email },
      action: 'ACCOUNT_REGISTER',
      entityType: 'User',
      entityId: user.id,
      summary: `Yeni hesap kaydi: ${user.firstName} ${user.lastName} (${user.email})`,
    });

    return {
      message:
        'Kaydiniz alindi. Hesabiniz admin onayindan sonra aktiflesecektir.',
      status: user.status,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException('E-posta veya sifre hatali.');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('E-posta veya sifre hatali.');

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Hesabiniz askiya alinmis.');
    }
    if (user.status === 'REJECTED') {
      throw new UnauthorizedException('Hesap kaydiniz reddedilmis.');
    }

    const token = await this.jwt.signAsync({ sub: user.id });

    await this.audit.log({
      actor: { id: user.id, name: user.email },
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      summary: `Giris yapildi: ${user.email}`,
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        rank: user.rank,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  // Giris yapmis kullanicinin tam profilini (izinler dahil) dondurur
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        departments: { include: { department: true } },
      },
    });
    if (!user) throw new UnauthorizedException();

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      rank: user.rank,
      isSuperAdmin: user.isSuperAdmin,
      role: user.role
        ? { id: user.role.id, name: user.role.name }
        : null,
      permissions: user.isSuperAdmin
        ? 'ALL'
        : (user.role?.permissions ?? []),
      departments: user.departments.map((d) => ({
        id: d.department.id,
        name: d.department.name,
      })),
    };
  }

  // Kullanici kendi profilini gunceller (ad, soyad, telefon)
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone ?? null,
      },
    });

    await this.audit.log({
      actor: { id: userId, name: `${dto.firstName} ${dto.lastName}` },
      action: 'PROFILE_UPDATE',
      entityType: 'User',
      entityId: userId,
      summary: `Profil guncellendi: ${dto.firstName} ${dto.lastName}`,
    });

    return this.me(userId);
  }

  // Kullanici kendi sifresini degistirir (mevcut sifre dogrulanir)
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Mevcut sifre hatali.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.audit.log({
      actor: { id: userId, name: user.email },
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: userId,
      summary: `Sifre degistirildi: ${user.email}`,
    });

    return { message: 'Sifreniz guncellendi.' };
  }

  private async notifyApprovers(newUserId: string, fullName: string) {
    const approvers = await this.prisma.user.findMany({
      where: {
        status: 'VERIFIED',
        OR: [
          { isSuperAdmin: true },
          { role: { permissions: { has: 'USER_APPROVE' } } },
        ],
      },
      select: { id: true },
    });

    if (approvers.length === 0) return;

    await this.prisma.notification.createMany({
      data: approvers.map((a) => ({
        userId: a.id,
        type: 'GENERAL' as const,
        title: 'Yeni hesap onayi bekliyor',
        message: `${fullName} kayit oldu ve onayinizi bekliyor.`,
      })),
    });
  }
}
