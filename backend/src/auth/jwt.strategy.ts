import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  // Token gecerliyse cagrilir; guncel kullaniciyi DB'den yukleyip
  // izin listesini olusturur (rol degisiklikleri aninda yansir).
  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true,
        departments: { select: { departmentId: true } },
      },
    });

    if (!user) throw new UnauthorizedException('Kullanıcı bulunamadı.');
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Hesabınız askıya alınmış.');
    }

    return {
      id: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
      rank: user.rank,
      roleId: user.roleId,
      permissions: user.role?.permissions ?? [],
      departmentIds: user.departments.map((d) => d.departmentId),
    };
  }
}
