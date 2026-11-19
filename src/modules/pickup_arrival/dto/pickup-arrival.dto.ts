
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsInt,
  IsDateString,
  IsString,
  IsOptional,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class PickupArrivalDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  arrivalLatitude: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  arrivalLongitude: number;

  @IsDateString()
  arrivalTimestamp: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometerAtPickupKm: number;

  @IsString()
  @MaxLength(100)
  dockNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  arrivalNotes?: string;
}
