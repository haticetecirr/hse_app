// Backend enum ve model tipleri (paylasilan)

export type Permission =
  | 'REPORT_CREATE_ACCIDENT'
  | 'REPORT_CREATE_NEARMISS'
  | 'REPORT_VIEW_OWN'
  | 'REPORT_VIEW_DEPARTMENT'
  | 'REPORT_VIEW_ALL'
  | 'REPORT_UPDATE'
  | 'REPORT_DELETE'
  | 'REPORT_INVESTIGATE'
  | 'REPORT_ASSIGN'
  | 'REPORT_CLOSE'
  | 'ACTION_MANAGE'
  | 'USER_VIEW'
  | 'USER_APPROVE'
  | 'USER_MANAGE'
  | 'ROLE_MANAGE'
  | 'DEPARTMENT_MANAGE'
  | 'NOTIFICATION_SEND'
  | 'DASHBOARD_VIEW'
  | 'AUDIT_VIEW';

export type UserStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export type Rank =
  | 'WORKER'
  | 'TEAM_LEAD'
  | 'SUPERVISOR'
  | 'ENGINEER'
  | 'HSE_SPECIALIST'
  | 'HSE_MANAGER'
  | 'MANAGER'
  | 'DIRECTOR';

export const RANKS: Rank[] = [
  'WORKER',
  'TEAM_LEAD',
  'SUPERVISOR',
  'ENGINEER',
  'HSE_SPECIALIST',
  'HSE_MANAGER',
  'MANAGER',
  'DIRECTOR',
];

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: UserStatus;
  rank: Rank | null;
  isSuperAdmin: boolean;
  role: { id: string; name: string } | null;
  permissions: Permission[] | 'ALL';
  departments: { id: string; name: string }[];
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  _count?: { members: number; reports: number };
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: Permission[];
  _count?: { users: number };
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: UserStatus;
  rank: Rank | null;
  isSuperAdmin: boolean;
  createdAt: string;
  verifiedAt?: string;
  role: { id: string; name: string; permissions: Permission[] } | null;
  departments: { id: string; name: string }[];
}

export type ReportType = 'ACCIDENT' | 'NEAR_MISS';
export type ReportStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'INVESTIGATING'
  | 'ACTIONS_PENDING'
  | 'CLOSED'
  | 'REJECTED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BodyInjury {
  id?: string;
  bodyPart: string;
  side: string;
  view: string;
  type: string;
  otherType?: string;
  severity: string;
  note?: string;
}

export interface CorrectiveAction {
  id: string;
  description: string;
  status: string;
  dueDate?: string;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
}

export interface Report {
  id: string;
  referenceNo: string;
  type: ReportType;
  status: ReportStatus;
  occurredAt: string;
  reportedAt: string;
  location: string;
  description: string;
  witnesses?: string;
  attachments?: string[];
  reporter: { id: string; firstName: string; lastName: string };
  department?: { id: string; name: string } | null;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  closedBy?: { id: string; firstName: string; lastName: string } | null;
  // Accident
  accidentType?: string;
  otherAccidentType?: string;
  outcomeSeverity?: string;
  isInjured?: boolean;
  injuredName?: string;
  injuredType?: string;
  otherInjuredType?: string;
  bodyInjuries?: BodyInjury[];
  // Near-miss
  nearMissCategory?: string;
  hazardCategory?: string;
  otherHazard?: string;
  severityScore?: number;
  likelihoodScore?: number;
  riskScore?: number;
  riskLevel?: RiskLevel;
  rootCause?: string;
  immediateAction?: string;
  correctiveActions?: CorrectiveAction[];
  closingNote?: string;
  _count?: { bodyInjuries: number; correctiveActions: number };
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  reportId?: string;
  createdAt: string;
}

// Enum secenek listeleri (formlarda kullanilir)
export const ACCIDENT_TYPES = [
  'SLIP_TRIP_FALL',
  'FALL_FROM_HEIGHT',
  'STRUCK_BY_OBJECT',
  'CAUGHT_IN_BETWEEN',
  'ELECTRIC_SHOCK',
  'BURN_THERMAL',
  'CHEMICAL_EXPOSURE',
  'CUT_LACERATION',
  'MANUAL_HANDLING',
  'MACHINERY',
  'VEHICLE_FORKLIFT',
  'FIRE_EXPLOSION',
  'NOISE_VIBRATION',
  'BIOLOGICAL',
  'OTHER',
];

export const OUTCOME_SEVERITIES = [
  'NO_INJURY',
  'FIRST_AID',
  'MEDICAL_TREATMENT',
  'RESTRICTED_WORK',
  'LOST_TIME',
  'FATALITY',
];

export const PERSON_TYPES = ['EMPLOYEE', 'CONTRACTOR', 'VISITOR', 'OTHER'];

export const NEAR_MISS_CATEGORIES = [
  'UNSAFE_ACT',
  'UNSAFE_CONDITION',
  'NEAR_MISS_EVENT',
  'PROPERTY_DAMAGE',
  'ENVIRONMENTAL',
];

export const HAZARD_CATEGORIES = [
  'SLIPS_TRIPS_FALLS',
  'WORKING_AT_HEIGHT',
  'ELECTRICAL',
  'FIRE_EXPLOSION',
  'CHEMICAL',
  'MACHINERY_EQUIPMENT',
  'MANUAL_HANDLING_ERGONOMICS',
  'STRUCK_CAUGHT',
  'PRESSURE_CONFINED_SPACE',
  'VEHICLE_TRAFFIC',
  'ENVIRONMENTAL_SPILL',
  'NOISE_VIBRATION',
  'HOUSEKEEPING',
  'PPE',
  'OTHER',
];

export const INJURY_TYPES = [
  'BRUISE',
  'CUT_LACERATION',
  'FRACTURE',
  'BURN',
  'SPRAIN_STRAIN',
  'DISLOCATION',
  'AMPUTATION',
  'CRUSH',
  'PUNCTURE',
  'CHEMICAL_BURN',
  'ELECTRIC',
  'FOREIGN_BODY',
  'OTHER',
];

export const INJURY_SEVERITIES = ['MINOR', 'MODERATE', 'SEVERE', 'CRITICAL'];

export const REPORT_STATUSES: ReportStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'INVESTIGATING',
  'ACTIONS_PENDING',
  'CLOSED',
  'REJECTED',
];

// URL bir video mu? (uzantiya gore)
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|avi|mkv|m4v)(\?|$)/i.test(url);
}

// Bir kullanicinin belirli izne sahip olup olmadigini kontrol eder
export function hasPermission(me: Me | null, ...perms: Permission[]): boolean {
  if (!me) return false;
  if (me.isSuperAdmin || me.permissions === 'ALL') return true;
  return perms.some((p) => (me.permissions as Permission[]).includes(p));
}
