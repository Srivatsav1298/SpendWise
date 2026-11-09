import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { TransactionStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
export class SimulateTransactionDto {
  @IsUUID() cardId: string;
  @Matches(/^(?!0+(\.0+)?$)\d{1,12}(\.\d{1,2})?$/, { message: 'amount must be a positive decimal with at most 2 decimals' }) amount: string;
  @trim() @IsString() @MinLength(2) @MaxLength(120) merchant: string;
  @trim() @IsString() @MinLength(2) @MaxLength(60) category: string;
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)) @Matches(/^[A-Z]{3}$/) currency?: string;
}
export class TransactionQuery extends PaginationDto {
  @IsOptional() @IsUUID() cardId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsEnum(TransactionStatus) status?: TransactionStatus;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() flagged?: boolean;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
