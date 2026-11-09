import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { CardStatus } from '@prisma/client';
import { MONEY } from '../budgets/dto';

const POSITIVE = /^(?!0+(\.0+)?$)\d{1,12}(\.\d{1,2})?$/;
void MONEY;
export class IssueCardDto {
  @IsUUID() employeeId: string;
  @IsOptional() @IsString() @MaxLength(60) label?: string;
  @Matches(POSITIVE) dailyLimit: string;
  @Matches(POSITIVE) monthlyLimit: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => String(v).trim()) : value)) blockedCategories?: string[];
}
export class UpdateCardDto {
  @IsOptional() @IsString() @MaxLength(60) label?: string;
  @IsOptional() @Matches(POSITIVE) dailyLimit?: string;
  @IsOptional() @Matches(POSITIVE) monthlyLimit?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) blockedCategories?: string[];
}
export class CardStatusDto { @IsEnum(CardStatus) status: CardStatus; }
