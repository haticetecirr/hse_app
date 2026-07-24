import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { NotificationsService } from './notifications.service';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

class SendNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  // Bos ise tum onayli kullanicilara gonderilir
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.listForUser(user.id, unread === 'true');
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  // Manuel duyuru gonderme (yetki gerektirir)
  @RequirePermissions('NOTIFICATION_SEND')
  @Post('broadcast')
  async broadcast(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendNotificationDto,
  ) {
    let targetIds = dto.userIds;
    if (!targetIds || targetIds.length === 0) {
      const all = await this.prisma.user.findMany({
        where: { status: 'VERIFIED' },
        select: { id: true },
      });
      targetIds = all.map((u) => u.id);
    }
    return this.notifications.createMany(
      targetIds.map((uid) => ({
        userId: uid,
        senderId: user.id,
        type: 'GENERAL' as const,
        title: dto.title,
        message: dto.message,
      })),
    );
  }
}
