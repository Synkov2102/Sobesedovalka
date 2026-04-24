import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class TaskPresetFileDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'path is required' })
  @MaxLength(240)
  path!: string;

  @IsString()
  @MaxLength(100_000)
  content!: string;
}
