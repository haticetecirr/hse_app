import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Permission } from '@prisma/client';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

class RoleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}

class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}

@Controller('roles')
export class RolesController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Tum kullanilabilir izinlerin listesi (UI icin)
  @Get('permissions')
  allPermissions() {
    return Object.values(Permission);
  }

  @RequirePermissions('ROLE_MANAGE', 'USER_MANAGE', 'USER_APPROVE')
  @Get()
  findAll() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  }

  @RequirePermissions('ROLE_MANAGE')
  @Post()
  async create(
    @Body() dto: RoleDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const role = await this.prisma.role.create({ data: dto });
    await this.audit.log({
      actor: user,
      action: 'ROLE_CREATE',
      entityType: 'Role',
      entityId: role.id,
      summary: `Rol olusturuldu: ${role.name} (${dto.permissions.length} izin)`,
      meta: { permissions: dto.permissions },
      ip,
    });
    return role;
  }

  @RequirePermissions('ROLE_MANAGE')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Rol bulunamadi.');
    const updated = await this.prisma.role.update({ where: { id }, data: dto });
    await this.audit.log({
      actor: user,
      action: 'ROLE_UPDATE',
      entityType: 'Role',
      entityId: id,
      summary: `Rol guncellendi: ${updated.name}`,
      meta: dto as any,
      ip,
    });
    return updated;
  }

  @RequirePermissions('ROLE_MANAGE')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Rol bulunamadi.');
    if (role.isSystem) {
      throw new BadRequestException('Sistem rolleri silinemez.');
    }
    await this.prisma.user.updateMany({
      where: { roleId: id },
      data: { roleId: null },
    });
    await this.prisma.role.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: 'ROLE_DELETE',
      entityType: 'Role',
      entityId: id,
      summary: `Rol silindi: ${role.name}`,
      ip,
    });
    return { ok: true };
  }
}
