import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Bir bildirimin gorunurlugunu belirlemek icin gereken minimum alanlar.
 */
export interface ReportVisibility {
  reporterId: string;
  assignedToId: string | null;
  departmentId: string | null;
}

/**
 * Bildirim gorunurluk kurali. Daha once ReportsService.findOne icinde
 * satir arasinda duruyordu; korunan dosya ucunun ayni kurali tekrar
 * kullanabilmesi icin buraya tasindi. Kural DEGISTIRILMEDI.
 */
export function canUserViewReport(
  report: ReportVisibility,
  user: AuthUser,
): boolean {
  if (user.isSuperAdmin || user.permissions.includes('REPORT_VIEW_ALL')) {
    return true;
  }
  if (report.reporterId === user.id) return true;
  if (report.assignedToId === user.id) return true;

  return (
    user.permissions.includes('REPORT_VIEW_DEPARTMENT') &&
    !!report.departmentId &&
    user.departmentIds.includes(report.departmentId)
  );
}
