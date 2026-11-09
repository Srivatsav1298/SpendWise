import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const lower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{10,128}$/;
const PASSWORD_MSG = 'Password must be 10-128 characters and contain a letter and a digit';

export class RegisterDto {
  @lower() @IsEmail() email: string;
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG }) password: string;
  @trim() @IsString() @MinLength(1) @MaxLength(80) firstName: string;
  @trim() @IsString() @MinLength(1) @MaxLength(80) lastName: string;
  @trim() @IsString() @MinLength(2) @MaxLength(120) organisationName: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(3) baseCurrency?: string;
}
export class LoginDto {
  @lower() @IsEmail() email: string;
  @IsString() @MaxLength(128) password: string;
  @IsOptional() @IsUUID() organisationId?: string;
}
export class RefreshDto { @IsString() @MaxLength(256) refreshToken: string; }
export class ForgotPasswordDto { @lower() @IsEmail() email: string; }
export class ResetPasswordDto {
  @IsString() @MaxLength(256) token: string;
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG }) password: string;
}
export class AcceptInviteDto {
  @IsString() @MaxLength(256) token: string;
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG }) password: string;
  @trim() @IsString() @MinLength(1) @MaxLength(80) firstName: string;
  @trim() @IsString() @MinLength(1) @MaxLength(80) lastName: string;
}
