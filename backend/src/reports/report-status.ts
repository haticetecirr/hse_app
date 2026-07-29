import { BadRequestException } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';

/**
 * Bildirim durum gecisleri icin TEK kaynak.
 * Bu liste baska bir backend dosyasina kopyalanmamalidir; gecis kontrolu
 * gereken her yer bu dosyadaki yardimcilari kullanir.
 *
 * CLOSED ve REJECTED son durumlardir: bos dizi -> yeniden acilamaz.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> =
  {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW', 'INVESTIGATING', 'REJECTED'],
    UNDER_REVIEW: ['INVESTIGATING', 'REJECTED'],
    INVESTIGATING: ['ACTIONS_PENDING', 'CLOSED', 'REJECTED'],
    ACTIONS_PENDING: ['INVESTIGATING', 'CLOSED'],
    CLOSED: [],
    REJECTED: [],
  };

// Hata mesajlarinda kullanilan Turkce durum etiketleri.
export const STATUS_LABELS_TR: Record<ReportStatus, string> = {
  DRAFT: 'Taslak',
  SUBMITTED: 'Gönderildi',
  UNDER_REVIEW: 'İnceleniyor',
  INVESTIGATING: 'Soruşturuluyor',
  ACTIONS_PENDING: 'Faaliyet Bekliyor',
  CLOSED: 'Kapatıldı',
  REJECTED: 'Reddedildi',
};

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Gecis gecerli degilse kullaniciya gosterilebilir Turkce mesajla
 * BadRequestException firlatir.
 */
export function assertCanTransition(from: ReportStatus, to: ReportStatus) {
  if (canTransition(from, to)) return;

  const fromLabel = STATUS_LABELS_TR[from];
  const toLabel = STATUS_LABELS_TR[to];

  // Son durumlar icin daha net bir mesaj ver.
  if (ALLOWED_STATUS_TRANSITIONS[from].length === 0) {
    throw new BadRequestException(
      `Bu bildirim "${fromLabel}" durumundan başka bir duruma geçirilemez.`,
    );
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[from]
    .map((s) => STATUS_LABELS_TR[s])
    .join(', ');

  throw new BadRequestException(
    `"${fromLabel}" durumundaki bir bildirim "${toLabel}" durumuna geçirilemez. ` +
      `Geçerli durumlar: ${allowed}.`,
  );
}
