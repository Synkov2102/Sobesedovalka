import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VkLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  deviceId!: string;

  @IsString()
  @MinLength(43)
  @MaxLength(128)
  codeVerifier!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  state?: string;
}
