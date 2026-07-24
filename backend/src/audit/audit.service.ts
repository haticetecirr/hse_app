import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

interface LogInput {
  actor?: AuthUser | { id: string; name: string } | null;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  meta?: Prisma.InputJsonValue;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  // Denetim kaydi olusturur. Hata olsa bile ana islem akisini bozmaz.
  async log(input: LogInput) {
    try {
      let actorId: string | null = null;
      let actorName = 'Sistem';

      if (input.actor) {
        if ('email' in input.actor) {
          // AuthUser
          actorId = input.actor.id;
          actorName = input.actor.email;
        } else {
          actorId = input.actor.id;
          actorName = input.actor.name;
        }
      }

      await this.prisma.auditLog.create({
        data: {
          actorId,
          actorName,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          summary: input.summary,
          meta: input.meta,
          ip: input.ip,
        },
      });
    } catch (e) {
      // Audit basarisiz olsa bile islemi engelleme
      // eslint-disable-next-line no-console
      console.error('Audit log yazilamadi:', e);
    }
  }

  async findAll(filters: { action?: string; entityType?: string }) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }
}
