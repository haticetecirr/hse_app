import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  ApproveUserDto,
  RejectUserDto,
  UpdateUserAuthorizationDto,
} from './dto/user.dto';

@Controller('users')
export class UsersController {
  constructor(
    private users: UsersService,
    private audit: AuditService,
  ) {}

  @RequirePermissions('USER_VIEW', 'USER_APPROVE', 'USER_MANAGE')
  @Get()
  findAll(@Query('status') status?: string) {
    return this.users.findAll(status);
  }

  // DIKKAT: Bu route ':id' route'undan ONCE tanimli olmali. Aksi halde
  // Nest "assignable" kelimesini bir kullanici ID'si olarak yorumlar.
  // RequirePermissions coklu izni OR olarak degerlendirir (PermissionsGuard
  // icinde .some()); yani bu uclerden herhangi biri yeterlidir.
  @RequirePermissions('REPORT_ASSIGN', 'ACTION_MANAGE', 'REPORT_INVESTIGATE')
  @Get('assignable')
  findAssignable() {
    return this.users.findAssignable();
  }

  @RequirePermissions('USER_VIEW', 'USER_APPROVE', 'USER_MANAGE')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @RequirePermissions('USER_APPROVE')
  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveUserDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const result = await this.users.approve(id, dto, user.id);
    await this.audit.log({
      actor: user,
      action: 'USER_APPROVE',
      entityType: 'User',
      entityId: id,
      summary: `${result.firstName} ${result.lastName} onaylandı (rol: ${result.role?.name || '-'}, rütbe: ${result.rank || '-'})`,
      ip,
    });
    return result;
  }

  @RequirePermissions('USER_APPROVE')
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectUserDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const result = await this.users.reject(id, dto);
    await this.audit.log({
      actor: user,
      action: 'USER_REJECT',
      entityType: 'User',
      entityId: id,
      summary: `Kullanıcı kaydı reddedildi${dto.reason ? ' (' + dto.reason + ')' : ''}`,
      ip,
    });
    return result;
  }

  @RequirePermissions('USER_MANAGE')
  @Patch(':id/authorization')
  async updateAuthorization(
    @Param('id') id: string,
    @Body() dto: UpdateUserAuthorizationDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const result = await this.users.updateAuthorization(id, dto);
    await this.audit.log({
      actor: user,
      action: 'USER_AUTHORIZATION_UPDATE',
      entityType: 'User',
      entityId: id,
      summary: `${result.firstName} ${result.lastName} yetkileri güncellendi (rol: ${result.role?.name || '-'}, rütbe: ${result.rank || '-'})`,
      meta: dto as any,
      ip,
    });
    return result;
  }

  @RequirePermissions('USER_MANAGE')
  @Post(':id/suspend')
  async suspend(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const result = await this.users.setStatus(id, 'SUSPENDED');
    await this.audit.log({
      actor: user,
      action: 'USER_SUSPEND',
      entityType: 'User',
      entityId: id,
      summary: `${result.firstName} ${result.lastName} askıya alındı`,
      ip,
    });
    return result;
  }

  @RequirePermissions('USER_MANAGE')
  @Post(':id/reactivate')
  async reactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const result = await this.users.setStatus(id, 'VERIFIED');
    await this.audit.log({
      actor: user,
      action: 'USER_REACTIVATE',
      entityType: 'User',
      entityId: id,
      summary: `${result.firstName} ${result.lastName} yeniden aktif edildi`,
      ip,
    });
    return result;
  }
}
