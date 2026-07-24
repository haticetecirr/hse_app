import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReportStatus, RiskLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  AssignReportDto,
  CreateAccidentDto,
  CreateActionDto,
  CreateNearMissDto,
  UpdateStatusDto,
} from './dto/report.dto';

const reportInclude = {
  reporter: { select: { id: true, firstName: true, lastName: true } },
  department: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
  bodyInjuries: true,
  correctiveActions: {
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ReportInclude;

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // 5x5 risk matrisi -> risk seviyesi
  static computeRisk(severity: number, likelihood: number) {
    const score = severity * likelihood;
    let level: RiskLevel;
    if (score <= 4) level = 'LOW';
    else if (score <= 9) level = 'MEDIUM';
    else if (score <= 15) level = 'HIGH';
    else level = 'CRITICAL';
    return { score, level };
  }

  private async nextReferenceNo(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `HSE-${year}-`;
    const count = await this.prisma.report.count({
      where: { referenceNo: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  async createAccident(dto: CreateAccidentDto, user: AuthUser) {
    const referenceNo = await this.nextReferenceNo();
    const report = await this.prisma.report.create({
      data: {
        referenceNo,
        type: 'ACCIDENT',
        status: 'SUBMITTED',
        reporterId: user.id,
        departmentId: dto.departmentId,
        occurredAt: new Date(dto.occurredAt),
        location: dto.location,
        description: dto.description,
        witnesses: dto.witnesses,
        attachments: dto.attachments ?? [],
        accidentType: dto.accidentType,
        otherAccidentType:
          dto.accidentType === 'OTHER' ? dto.otherAccidentType : null,
        outcomeSeverity: dto.outcomeSeverity,
        isInjured: dto.isInjured,
        injuredName: dto.injuredName,
        injuredType: dto.injuredType,
        bodyInjuries: dto.bodyInjuries
          ? {
              create: dto.bodyInjuries.map((b) => ({
                bodyPart: b.bodyPart,
                side: b.side ?? 'CENTER',
                view: b.view ?? 'FRONT',
                type: b.type,
                severity: b.severity ?? 'MINOR',
                note: b.note,
              })),
            }
          : undefined,
      },
      include: reportInclude,
    });

    await this.notifyNewReport(report.id, referenceNo, 'Is kazasi');
    return report;
  }

  async createNearMiss(dto: CreateNearMissDto, user: AuthUser) {
    const referenceNo = await this.nextReferenceNo();
    const { score, level } = ReportsService.computeRisk(
      dto.severityScore,
      dto.likelihoodScore,
    );

    const report = await this.prisma.report.create({
      data: {
        referenceNo,
        type: 'NEAR_MISS',
        status: 'SUBMITTED',
        reporterId: user.id,
        departmentId: dto.departmentId,
        occurredAt: new Date(dto.occurredAt),
        location: dto.location,
        description: dto.description,
        witnesses: dto.witnesses,
        attachments: dto.attachments ?? [],
        nearMissCategory: dto.nearMissCategory,
        hazardCategory: dto.hazardCategory,
        otherHazard: dto.hazardCategory === 'OTHER' ? dto.otherHazard : null,
        severityScore: dto.severityScore,
        likelihoodScore: dto.likelihoodScore,
        riskScore: score,
        riskLevel: level,
        rootCause: dto.rootCause,
        immediateAction: dto.immediateAction,
      },
      include: reportInclude,
    });

    await this.notifyNewReport(report.id, referenceNo, 'Ramak kala');
    return report;
  }

  // Yetki kapsamina gore listeleme filtresi olusturur
  private scopeFilter(user: AuthUser): Prisma.ReportWhereInput {
    if (user.isSuperAdmin || user.permissions.includes('REPORT_VIEW_ALL')) {
      return {};
    }
    const or: Prisma.ReportWhereInput[] = [{ reporterId: user.id }];
    if (user.permissions.includes('REPORT_VIEW_DEPARTMENT')) {
      or.push({ departmentId: { in: user.departmentIds } });
    }
    // Atanan bildirimleri de gorebilsin
    or.push({ assignedToId: user.id });
    return { OR: or };
  }

  async findAll(
    user: AuthUser,
    filters: { type?: string; status?: string; departmentId?: string },
  ) {
    const where: Prisma.ReportWhereInput = {
      AND: [
        this.scopeFilter(user),
        filters.type ? { type: filters.type as any } : {},
        filters.status ? { status: filters.status as any } : {},
        filters.departmentId ? { departmentId: filters.departmentId } : {},
      ],
    };

    return this.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
        department: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { bodyInjuries: true, correctiveActions: true } },
      },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: reportInclude,
    });
    if (!report) throw new NotFoundException('Bildirim bulunamadi.');

    const canViewAll =
      user.isSuperAdmin || user.permissions.includes('REPORT_VIEW_ALL');
    const isOwn = report.reporterId === user.id;
    const isAssigned = report.assignedToId === user.id;
    const inDept =
      user.permissions.includes('REPORT_VIEW_DEPARTMENT') &&
      report.departmentId &&
      user.departmentIds.includes(report.departmentId);

    if (!canViewAll && !isOwn && !isAssigned && !inDept) {
      throw new ForbiddenException('Bu bildirimi gorme yetkiniz yok.');
    }
    return report;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, user: AuthUser) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Bildirim bulunamadi.');

    if (
      dto.status === 'CLOSED' &&
      !user.isSuperAdmin &&
      !user.permissions.includes('REPORT_CLOSE')
    ) {
      throw new ForbiddenException('Kapatma yetkiniz yok.');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status,
        closingNote:
          dto.status === 'CLOSED' ? dto.closingNote : report.closingNote,
        closedById: dto.status === 'CLOSED' ? user.id : report.closedById,
        closedAt: dto.status === 'CLOSED' ? new Date() : report.closedAt,
      },
      include: reportInclude,
    });

    // Bildiren kisiye durum degisikligini haber ver
    if (report.reporterId !== user.id) {
      await this.notifications.create({
        userId: report.reporterId,
        type: 'REPORT_STATUS_CHANGED',
        title: 'Bildirim durumu guncellendi',
        message: `${report.referenceNo} numarali bildiriminizin durumu: ${dto.status}`,
        reportId: report.id,
      });
    }
    return updated;
  }

  async assign(id: string, dto: AssignReportDto, user: AuthUser) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Bildirim bulunamadi.');

    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
    });
    if (!assignee || assignee.status !== 'VERIFIED') {
      throw new BadRequestException('Gecersiz atanan kullanici.');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        assignedToId: dto.assignedToId,
        status:
          report.status === 'SUBMITTED' ? 'INVESTIGATING' : report.status,
      },
      include: reportInclude,
    });

    await this.notifications.create({
      userId: dto.assignedToId,
      type: 'REPORT_ASSIGNED',
      title: 'Size bir bildirim atandi',
      message: `${report.referenceNo} numarali bildirim sorusturma icin size atandi.`,
      reportId: report.id,
      senderId: user.id,
    });
    return updated;
  }

  async addAction(reportId: string, dto: CreateActionDto, user: AuthUser) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Bildirim bulunamadi.');

    const action = await this.prisma.correctiveAction.create({
      data: {
        reportId,
        description: dto.description,
        assignedToId: dto.assignedToId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    if (report.status === 'INVESTIGATING' || report.status === 'SUBMITTED') {
      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'ACTIONS_PENDING' },
      });
    }

    if (dto.assignedToId) {
      await this.notifications.create({
        userId: dto.assignedToId,
        type: 'ACTION_ASSIGNED',
        title: 'Size bir faaliyet atandi',
        message: `${report.referenceNo}: ${dto.description}`,
        reportId,
        senderId: user.id,
      });
    }
    return action;
  }

  async updateActionStatus(
    actionId: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED',
  ) {
    const action = await this.prisma.correctiveAction.findUnique({
      where: { id: actionId },
    });
    if (!action) throw new NotFoundException('Faaliyet bulunamadi.');
    return this.prisma.correctiveAction.update({
      where: { id: actionId },
      data: {
        status,
        completedAt:
          status === 'COMPLETED' || status === 'VERIFIED'
            ? new Date()
            : null,
      },
    });
  }

  // Panel istatistikleri
  async stats(user: AuthUser) {
    const scope = this.scopeFilter(user);
    const [total, byType, byStatus, byRisk, openActions] = await Promise.all([
      this.prisma.report.count({ where: scope }),
      this.prisma.report.groupBy({
        by: ['type'],
        where: scope,
        _count: true,
      }),
      this.prisma.report.groupBy({
        by: ['status'],
        where: scope,
        _count: true,
      }),
      this.prisma.report.groupBy({
        by: ['riskLevel'],
        where: { AND: [scope, { type: 'NEAR_MISS' }] },
        _count: true,
      }),
      this.prisma.correctiveAction.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] } },
      }),
    ]);

    return {
      total,
      byType: Object.fromEntries(byType.map((x) => [x.type, x._count])),
      byStatus: Object.fromEntries(
        byStatus.map((x) => [x.status, x._count]),
      ),
      byRisk: Object.fromEntries(
        byRisk.filter((x) => x.riskLevel).map((x) => [x.riskLevel, x._count]),
      ),
      openActions,
    };
  }

  private async notifyNewReport(
    reportId: string,
    referenceNo: string,
    typeLabel: string,
  ) {
    await this.notifications.notifyByPermission('REPORT_VIEW_ALL', {
      type: 'REPORT_SUBMITTED',
      title: `Yeni ${typeLabel} bildirimi`,
      message: `${referenceNo} numarali yeni bir ${typeLabel.toLowerCase()} bildirimi olusturuldu.`,
      reportId,
    });
  }
}
