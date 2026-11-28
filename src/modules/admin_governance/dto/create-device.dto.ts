import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsOptional()
  @IsString()
  imei?: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryPercent?: number;

  @IsOptional()
  @IsString()
  signal?: string;

  @IsOptional()
  @IsString()
  linkedVehicle?: string;

  @IsOptional()
  @IsString()
  calibrationExpiry?: string;
}