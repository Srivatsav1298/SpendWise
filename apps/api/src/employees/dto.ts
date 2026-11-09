import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { MONEY } from '../budgets/dto';

export class InviteDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() email: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @Matches(MONEY) monthlyLimit?: string;
}
export class UpdateEmployeeDto {
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsUUID() departmentId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) jobTitle?: string;
  @IsOptional() @Matches(MONEY) monthlyLimit?: string | null;
}
export class EmployeeQuery extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(80) search?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() active?: boolean;
}
