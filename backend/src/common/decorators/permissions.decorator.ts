import { SetMetadata } from '@nestjs/common';
import { Permission } from '@prisma/client';

export const PERMISSIONS_KEY = 'required_permissions';

// Bir uca erisim icin gereken izin(ler). Kullanici bunlardan
// herhangi birine (OR) sahipse gecer. Super admin her zaman gecer.
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const IS_PUBLIC_KEY = 'is_public';
// Ucu auth gerektirmeyen (herkese acik) olarak isaretler.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
