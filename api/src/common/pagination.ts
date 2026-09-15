import { IsOptional, IsString, Min, Max, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Input DTO for cursor-based pagination.
 * cursor: opaque string pointing to a position in the dataset (base64-encoded ID)
 * limit: number of items to return (default 20, max 100)
 */
export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Response wrapper for cursor-paginated data.
 * items: the actual results
 * nextCursor: cursor pointing to the next batch, or null if no more results
 * hasMore: boolean indicating whether more results exist
 */
export interface CursorPaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Encode an ID as a cursor (base64 encoding for opacity).
 */
export function toCursor(id: string): string {
  return Buffer.from(id).toString('base64');
}

/**
 * Decode a cursor back to an ID.
 */
export function fromCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8');
}

/**
 * Build a Prisma query condition that returns results after the cursor.
 * This assumes ordering by `id` in ascending order.
 *
 * Returns a where condition that filters records to those after the cursor position.
 */
export function buildCursorQuery(cursor: string | undefined): { id: { gt: string } } | undefined {
  if (!cursor) return undefined;
  const id = fromCursor(cursor);
  return { id: { gt: id } };
}
