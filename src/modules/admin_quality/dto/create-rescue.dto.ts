import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRescueDto {
  @IsString()
  @IsNotEmpty()
  tripReference: string;

  @IsNumber()
  @Min(1)
  rescueRadiusKm: number;

  @IsString()
  @IsNotEmpty()
  customerDecision: string;

  @IsOptional()
  @IsString()
  rescueVehicleRegistration?: string;

  @IsOptional()
  @IsString()
  transferCostNotes?: string;
}