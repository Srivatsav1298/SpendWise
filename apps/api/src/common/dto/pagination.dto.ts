import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize: number = 20;
}
export const pageArgs = (p: PaginationDto) => ({ skip: (p.page - 1) * p.pageSize, take: p.pageSize });
export const pageMeta = (p: PaginationDto, total: number) => ({ page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) });
