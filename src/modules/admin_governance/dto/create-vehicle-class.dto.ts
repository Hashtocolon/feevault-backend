import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateVehicleClassDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  className: string;

  @IsNumber()
  @Min(0)
  payloadKg: number;

  @IsNumber()
  @Min(0)
  volumeM3: number;

  @IsString()
  @IsNotEmpty()
  temperatureRange: string;

  @IsInt()
  @Min(1)
  compartments: number;
}