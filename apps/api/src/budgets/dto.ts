import { IsBoolean, IsDateString, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateBudgetDto {
  @trim() @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @Matches(MONEY, { message: 'amount must be a positive decimal with at most 2 decimals' }) amount: string;
  @IsDateString() periodStart: string;
  @IsDateString() periodEnd: string;
}
export class UpdateBudgetDto {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @Matches(MONEY) amount?: string;
  @IsOptional() @IsDateString() periodStart?: string;
  @IsOptional() @IsDateString() periodEnd?: string;
}
export class PolicyDto {
  @trim() @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @trim() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @Matches(MONEY) maxAmountPerExpense?: string;
  @IsOptional() @IsBoolean() requireReceipt?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
