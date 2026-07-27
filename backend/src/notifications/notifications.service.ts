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
  // Bildirimin konusu olan kullanici (or. onay bekleyen kayit)
  targetUserId?: string;
}

// Bildirim listesinde hedef kullanicinin guncel durumu da donulur;
// boylece istemci "tamamlandi" rozetini gosterebilir.
const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  reportId: true,
  targetUserId: true,
  isRead: true,
  createdAt: true,
  targetUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
    },
  },
};

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
      select: notificationSelect,
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

  // Bir kayit onaylanip/reddedilince tum onayculardaki ilgili
  // "onay bekliyor" bildirimleri tamamlanmis (okundu) sayilir.
  async resolveAccountApproval(targetUserId: string) {
    await this.prisma.notification.updateMany({
      where: {
        type: 'ACCOUNT_PENDING_APPROVAL',
        targetUserId,
        isRead: false,
      },
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
