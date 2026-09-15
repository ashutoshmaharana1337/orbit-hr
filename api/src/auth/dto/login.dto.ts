import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  // Deliberately no MinLength here: login must not reveal the password
  // policy through a validation error. Length rules live on register/reset.
  @IsString()
  @MaxLength(128)
  password!: string;
}
