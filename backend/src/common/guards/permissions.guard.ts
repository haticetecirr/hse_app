import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@prisma/client';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Izin sarti yoksa (sadece giris yeterli)
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthUser = request.user;

    if (!user) throw new ForbiddenException('Yetkilendirme bilgisi yok.');

    // Super admin her seyi yapabilir
    if (user.isSuperAdmin) return true;

    // Yalnizca onaylanmis kullanicilar yetki kullanabilir
    if (user.status !== 'VERIFIED') {
      throw new ForbiddenException(
        'Hesabınız henüz onaylanmadı. Lütfen admin onayını bekleyin.',
      );
    }

    const has = required.some((p) => user.permissions.includes(p));
    if (!has) {
      throw new ForbiddenException('Bu işlem için yetkiniz bulunmuyor.');
    }
    return true;
  }
}
