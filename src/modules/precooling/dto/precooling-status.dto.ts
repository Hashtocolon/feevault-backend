import { Type, Transform } from 'class-transformer';
import {
  IsNumber,
  IsInt,
  IsBoolean,
  IsDateString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

const toBoolean = ({ value }: { value: any }) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class PrecoolingStatusDto {
  @Type(() => Number)
  @IsNumber()
  chamberTemperatureCelsius: number;

  @Type(() => Number)
  @IsNumber()
  targetSetpointCelsius: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  preCoolingDurationMinutes: number;

  @Transform(toBoolean)
  @IsBoolean()
  isReadingSourceIot: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  iotBatteryLevelPercent?: number;

  @IsDateString()
  timeTargetReached: string;
}