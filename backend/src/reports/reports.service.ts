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
import {
  assertCanTransition,
  canTransition,
  STATUS_LABELS_TR,
} from './report-status';
import { canUserViewReport } from './report-access';

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

  // Referans no: HSE-GG.AA.YYYY-NNN (sira her gun sifirdan baslar)
  private async nextReferenceNo(): Promise<string> {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const prefix = `HSE-${dd}.${mm}.${yyyy}-`;
    // Bugune ait bildirim sayisini bul -> gunluk sira
    const count = await this.prisma.report.count({
      where: { referenceNo: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
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
        otherInjuredType:
          dto.injuredType === 'OTHER' ? dto.otherInjuredType : null,
        bodyInjuries: dto.bodyInjuries
          ? {
              create: dto.bodyInjuries.map((b) => ({
                bodyPart: b.bodyPart,
                side: b.side ?? 'CENTER',
                view: b.view ?? 'FRONT',
                type: b.type,
                otherType: b.type === 'OTHER' ? b.otherType : null,
                severity: b.severity ?? 'MINOR',
                note: b.note,
              })),
            }
          : undefined,
      },
      include: reportInclude,
    });

    await this.notifyNewReport(report.id, referenceNo, 'İş kazası');
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
    if (!report) throw new NotFoundException('Bildirim bulunamadı.');

    if (!canUserViewReport(report, user)) {
      throw new ForbiddenException('Bu bildirimi görme yetkiniz yok.');
    }
    return report;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, user: AuthUser) {
    // Yetki kontrolu DB'ye dokunmadan once yapilir -> yetkisiz kullanici 403 alir.
    if (
      dto.status === 'CLOSED' &&
      !user.isSuperAdmin &&
      !user.permissions.includes('REPORT_CLOSE')
    ) {
      throw new ForbiddenException('Bildirimi kapatma yetkiniz yok.');
    }

    // Okuma + dogrulama + yazma tek transaction icinde; boylece kontrol ile
    // guncelleme arasinda durum degisemez.
    const { report: updated, previousStatus } = await this.prisma.$transaction(
      async (tx) => {
        const report = await tx.report.findUnique({
          where: { id },
          include: { correctiveActions: { select: { status: true } } },
        });
        if (!report) throw new NotFoundException('Bildirim bulunamadı.');

        const previousStatus = report.status;

        if (previousStatus === dto.status) {
          throw new BadRequestException(
            `Bildirim zaten "${STATUS_LABELS_TR[previousStatus]}" durumunda.`,
          );
        }

        // Merkezi gecis kurallari (bkz. report-status.ts)
        assertCanTransition(previousStatus, dto.status);

        // CLOSED disindaki gecislerde mevcut kapanis bilgileri korunur;
        // gonderilen closingNote kapanis bilgisi olarak kaydedilmez.
        let closingNote = report.closingNote;
        let closedById = report.closedById;
        let closedAt = report.closedAt;

        if (dto.status === 'CLOSED') {
          const note = (dto.closingNote ?? '').trim();
          if (note.length < 10) {
            throw new BadRequestException(
              'Kapatma açıklaması zorunludur ve en az 10 karakter olmalıdır.',
            );
          }

          // Bagli faaliyet varsa hepsi VERIFIED olmali (OPEN, IN_PROGRESS,
          // COMPLETED ve OVERDUE kapatmayi engeller). Hic faaliyet yoksa serbest.
          const pending = report.correctiveActions.filter(
            (a) => a.status !== 'VERIFIED',
          );
          if (pending.length > 0) {
            throw new BadRequestException(
              'Bildirim kapatılamadı. Bağlı düzeltici faaliyetlerin tamamı doğrulanmalıdır.',
            );
          }

          closingNote = note; // trimlenmis deger kaydedilir
          closedById = user.id;
          closedAt = new Date();
        }

        const result = await tx.report.update({
          where: { id },
          data: { status: dto.status, closingNote, closedById, closedAt },
          include: reportInclude,
        });

        return { report: result, previousStatus };
      },
    );

    // Bildiren kisiye durum degisikligini haber ver
    if (updated.reporterId !== user.id) {
      await this.notifications.create({
        userId: updated.reporterId,
        type: 'REPORT_STATUS_CHANGED',
        title: 'Bildirim durumu güncellendi',
        message: `${updated.referenceNo} numaralı bildiriminizin durumu: ${dto.status}`,
        reportId: updated.id,
      });
    }

    return { report: updated, previousStatus };
  }

  async assign(id: string, dto: AssignReportDto, user: AuthUser) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Bildirim bulunamadı.');

    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
    });
    if (!assignee || assignee.status !== 'VERIFIED') {
      throw new BadRequestException('Geçersiz atanan kullanıcı.');
    }

    // Mevcut davranis korunur: SUBMITTED bir bildirim atandiginda otomatik
    // olarak INVESTIGATING'e gecer. Gecis merkezi kurallara karsi da
    // dogrulanir; kurala uymayan bir otomatik gecis uygulanmaz.
    const autoInvestigating =
      report.status === 'SUBMITTED' &&
      canTransition(report.status, 'INVESTIGATING');

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        assignedToId: dto.assignedToId,
        status: autoInvestigating ? 'INVESTIGATING' : report.status,
      },
      include: reportInclude,
    });

    await this.notifications.create({
      userId: dto.assignedToId,
      type: 'REPORT_ASSIGNED',
      title: 'Size bir bildirim atandı',
      message: `${report.referenceNo} numaralı bildirim soruşturma için size atandı.`,
      reportId: report.id,
      senderId: user.id,
    });
    return updated;
  }

  async addAction(reportId: string, dto: CreateActionDto, user: AuthUser) {
    // Faaliyet olusturma + otomatik durum gecisi tek transaction icinde.
    const { action, report } = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({ where: { id: reportId } });
      if (!report) throw new NotFoundException('Bildirim bulunamadı.');

      // Son durumlara faaliyet eklenemez.
      if (report.status === 'CLOSED' || report.status === 'REJECTED') {
        throw new BadRequestException(
          `"${STATUS_LABELS_TR[report.status]}" durumundaki bir bildirime düzeltici faaliyet eklenemez.`,
        );
      }

      // Hedef durum ACTIONS_PENDING. Zincirdeki her adim merkezi helper ile
      // dogrulanir; DB'ye yalnizca son durum yazilir, ara durum birakilmaz.
      let nextStatus: ReportStatus | null = null;
      if (report.status !== 'ACTIONS_PENDING') {
        if (canTransition(report.status, 'ACTIONS_PENDING')) {
          // Tek adim: INVESTIGATING -> ACTIONS_PENDING
          assertCanTransition(report.status, 'ACTIONS_PENDING');
        } else {
          // Iki adimli zincir: <mevcut> -> INVESTIGATING -> ACTIONS_PENDING
          // (or. SUBMITTED). Ikisi de merkezi kurallara gore gecerli olmali.
          assertCanTransition(report.status, 'INVESTIGATING');
          assertCanTransition('INVESTIGATING', 'ACTIONS_PENDING');
        }
        nextStatus = 'ACTIONS_PENDING';
      }

      const action = await tx.correctiveAction.create({
        data: {
          reportId,
          description: dto.description,
          assignedToId: dto.assignedToId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        },
      });

      if (nextStatus) {
        await tx.report.update({
          where: { id: reportId },
          data: { status: nextStatus },
        });
      }

      return { action, report };
    });

    if (dto.assignedToId) {
      await this.notifications.create({
        userId: dto.assignedToId,
        type: 'ACTION_ASSIGNED',
        title: 'Size bir faaliyet atandı',
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
    if (!action) throw new NotFoundException('Faaliyet bulunamadı.');
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
      message: `${referenceNo} numaralı yeni bir ${typeLabel.toLocaleLowerCase('tr')} bildirimi oluşturuldu.`,
      reportId,
    });
  }
}
