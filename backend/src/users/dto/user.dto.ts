import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Rank } from '@prisma/client';

// Kayit onayi (+ istege bagli ilk yetkilendirme)
export class ApproveUserDto {
  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsEnum(Rank)
  rank?: Rank;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];
}

export class RejectUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

// Yetkilendirme guncelleme (rol/rutbe/birim)
export class UpdateUserAuthorizationDto {
  @IsOptional()
  @IsString()
  roleId?: string | null;

  @IsOptional()
  @IsEnum(Rank)
  rank?: Rank | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];
}
