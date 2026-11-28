import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @MaxLength(200)
  customer: string;

  @IsString()
  @MaxLength(200)
  pickupLocation: string;

  @IsString()
  @MaxLength(200)
  dropLocation: string;

  @IsDateString()
  pickupDate: string;

  @IsString()
  pickupTimeWindow: string;

  @IsIn(['14 ft reefer', '17 ft reefer', '20 ft reefer'])
  vehicleClass: string;

  @IsIn([
    'Frozen meat',
    'Seafood',
    'Dairy',
    'Ice cream',
    'Bakery',
    'Dry goods',
  ])
  cargoCategory: string;

  @IsIn([
    '−18°C to −22°C',
    '−25°C',
    '+2°C to +8°C',
    '+15°C to +25°C',
  ])
  temperatureBand: string;

  @IsNumber()
  @Min(0)
  declaredValueInr: number;

  @IsOptional()
  @IsString()
  cargoHandlingNotes?: string;
}