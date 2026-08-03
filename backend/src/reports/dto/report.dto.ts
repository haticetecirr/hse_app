import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AccidentType,
  BodyPart,
  BodySide,
  BodyView,
  HazardCategory,
  InjurySeverity,
  InjuryType,
  NearMissCategory,
  OutcomeSeverity,
  PersonType,
  ReportStatus,
} from '@prisma/client';

export class BodyInjuryDto {
  @IsEnum(BodyPart)
  bodyPart: BodyPart;

  @IsOptional()
  @IsEnum(BodySide)
  side?: BodySide;

  @IsOptional()
  @IsEnum(BodyView)
  view?: BodyView;

  @IsEnum(InjuryType)
  type: InjuryType;

  @IsOptional()
  @IsString()
  otherType?: string; // type=OTHER ise

  @IsOptional()
  @IsEnum(InjurySeverity)
  severity?: InjurySeverity;

  @IsOptional()
  @IsString()
  note?: string;
}

// --- IS KAZASI ---
export class CreateAccidentDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsDateString()
  occurredAt: string;

  @IsString()
  @MinLength(3)
  location: string;

  @IsString()
  @MinLength(10, { message: 'Açıklama en az 10 karakter olmalı.' })
  description: string;

  @IsOptional()
  @IsString()
  witnesses?: string;

  @IsEnum(AccidentType)
  accidentType: AccidentType;

  @IsOptional()
  @IsString()
  otherAccidentType?: string; // accidentType=OTHER ise

  @IsEnum(OutcomeSeverity)
  outcomeSeverity: OutcomeSeverity;

  @IsBoolean()
  isInjured: boolean;

  @IsOptional()
  @IsString()
  injuredName?: string;

  @IsOptional()
  @IsEnum(PersonType)
  injuredType?: PersonType;

  @IsOptional()
  @IsString()
  otherInjuredType?: string; // injuredType=OTHER ise

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BodyInjuryDto)
  bodyInjuries?: BodyInjuryDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

// --- RAMAK KALA ---
export class CreateNearMissDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsDateString()
  occurredAt: string;

  @IsString()
  @MinLength(3)
  location: string;

  @IsString()
  @MinLength(10, { message: 'Açıklama en az 10 karakter olmalı.' })
  description: string;

  @IsOptional()
  @IsString()
  witnesses?: string;

  @IsEnum(NearMissCategory)
  nearMissCategory: NearMissCategory;

  @IsEnum(HazardCategory)
  hazardCategory: HazardCategory;

  @IsOptional()
  @IsString()
  otherHazard?: string; // hazardCategory=OTHER ise

  // 5x5 risk matrisi
  @IsInt()
  @Min(1)
  @Max(5)
  severityScore: number;

  @IsInt()
  @Min(1)
  @Max(5)
  likelihoodScore: number;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  immediateAction?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

// --- Is akisi ---
export class UpdateStatusDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  // Yalnizca ust sinir dogrulanir. Zorunluluk ve "trim sonrasi en az 10
  // karakter" kurali servis katmaninda, sadece CLOSED icin uygulanir;
  // boylece diger durum gecisleri yanlislikla engellenmez.
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Kapatma açıklaması en fazla 2000 karakter olabilir.' })
  closingNote?: string;
}

export class AssignReportDto {
  @IsString()
  assignedToId: string;
}

export class CreateActionDto {
  @IsString()
  @MinLength(5)
  description: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  // Foto/video yollari; Report.attachments ile ayni bicimde saklanir.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
