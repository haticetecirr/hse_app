import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Gecerli bir e-posta giriniz.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Sifre en az 6 karakter olmali.' })
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
  @IsEmail({}, { message: 'Gecerli bir e-posta giriniz.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Sifre zorunlu.' })
  password: string;
}
