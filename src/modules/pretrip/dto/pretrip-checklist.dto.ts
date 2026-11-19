import { Type, Transform } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

const toBoolean = ({ value }: { value: any }) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class PretripChecklistDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometerKm: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  truckFuelLevelPercent: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reeferDieselLiters: number;

  @Transform(toBoolean)
  @IsBoolean()
  tyresBrakesLights: boolean;

  @Transform(toBoolean)
  @IsBoolean()
  reeferCompressorFanBelt: boolean;

  @Transform(toBoolean)
  @IsBoolean()
  compartmentSanitised: boolean;

  @Transform(toBoolean)
  @IsBoolean()
  doorSealsAirtight: boolean;

  @Transform(toBoolean)
  @IsBoolean()
  documentsInTruck: boolean;

  @Transform(toBoolean)
  @IsBoolean()
  iotSensorsActive: boolean;

  @Transform(toBoolean)
  @IsBoolean()
  emergencyKitPresent: boolean;
}