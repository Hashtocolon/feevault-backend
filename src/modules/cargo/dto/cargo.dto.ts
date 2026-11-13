import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';

export class CargoCompatibilityDto {
  @IsString()
  vehicleClass: string;

  @IsNumber()
  @IsOptional()
  requiredTempMin?: number;

  @IsNumber()
  @IsOptional()
  requiredTempMax?: number;

  @IsString()
  @IsOptional()
  cargoType?: string;

  @IsArray()
  @IsOptional()
  cargoLines?: any[];
}

