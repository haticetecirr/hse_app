import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Geçerli bir e-posta giriniz.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalı.' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Ad zorunlu.' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Soyad zorunlu.' })
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Geçerli bir e-posta giriniz.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Şifre zorunlu.' })
  password: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Ad zorunlu.' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Soyad zorunlu.' })
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Mevcut şifre zorunlu.' })
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: 'Yeni şifre en az 6 karakter olmalı.' })
  newPassword: string;
}
