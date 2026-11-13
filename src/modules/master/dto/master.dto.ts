import { IsString, IsOptional } from 'class-validator';

export class ServiceabilityDto {
  @IsString()
  originPincode: string;

  @IsString()
  destinationPincode: string;
}

export class VehicleClassesDto {
  @IsString()
  @IsOptional()
  hiringModel?: string;
}

