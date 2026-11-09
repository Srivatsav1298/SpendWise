import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ExpenseStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { MONEY } from '../budgets/dto';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const POSITIVE = /^(?!0+(\.0+)?$)\d{1,12}(\.\d{1,2})?$/;

export class CreateExpenseDto {
  @Matches(POSITIVE, { message: 'amount must be a positive decimal with at most 2 decimals' }) amount: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)) @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' }) currency: string;
  @IsDateString() expenseDate: string;
  @trim() @IsString() @MinLength(2) @MaxLength(60) category: string;
  @trim() @IsString() @MinLength(2) @MaxLength(120) merchant: string;
  @IsOptional() @trim() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() submit?: boolean;
}
export class UpdateExpenseDto {
  @IsOptional() @Matches(POSITIVE) amount?: string;
  @IsOptional() @IsDateString() expenseDate?: string;
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(60) category?: string;
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(120) merchant?: string;
  @IsOptional() @trim() @IsString() @MaxLength(1000) description?: string;
}
export class ExpenseQuery extends PaginationDto {
  @IsOptional() @IsEnum(ExpenseStatus) status?: ExpenseStatus;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(80) search?: string;
}
export class DecisionDto {
  @IsOptional() @trim() @IsString() @MaxLength(1000) comment?: string;
}
export class RejectDto {
  @trim() @IsString() @MinLength(3, { message: 'A rejection reason is required (min 3 characters)' }) @MaxLength(1000) reason: string;
}
void MONEY;
