import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export class PrecoolingAbortDto {
  @IsString()
  @IsIn([
    'COMPRESSOR_TRIPPED',
    'REFRIGERANT_GAS_LEAK',
    'TEMPERATURE_TIMEOUT',
    'SENSOR_DEFECTIVE',
    'DOOR_SEAL_LEAKAGE',
    'OTHER_REEFER_FAULT',
  ])
  faultCode: string;

  @Type(() => Number)
  @IsNumber()
  currentTempCelsius: number;

  @IsString()
  @MaxLength(2000)
  faultDescription: string;
}