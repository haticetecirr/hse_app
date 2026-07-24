import { Injectable } from '@nestjs/common';
import { NotificationType, Permission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateNotification {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  reportId?: string;
  senderId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateNotification) {
    return this.prisma.notification.create({ data });
  }

  async createMany(items: CreateNotification[]) {
    if (items.length === 0) return { count: 0 };
    return this.prisma.notification.createMany({ data: items });
  }

  // Belirli bir izne sahip tum onayli kullanicilara (+ super adminlere) gonder
  async notifyByPermission(
    permission: Permission,
    payload: Omit<CreateNotification, 'userId'>,
  ) {
    const recipients = await this.prisma.user.findMany({
      where: {
        status: 'VERIFIED',
        OR: [
          { isSuperAdmin: true },
          { role: { permissions: { has: permission } } },
        ],
      },
      select: { id: true },
    });
    return this.createMany(
      recipients.map((r) => ({ ...payload, userId: r.id })),
    );
  }

  async listForUser(userId: string, onlyUnread = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(onlyUnread ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }
}
