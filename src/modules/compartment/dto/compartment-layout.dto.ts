
import {
  IsBoolean,
  IsArray,
  IsInt,
  IsString,
  IsIn,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

import { Type, Transform } from 'class-transformer';

const toBoolean = ({ value }: { value: any }) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class CompartmentItemDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  compartmentNumber: number;

  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  doorNumber: number;

  @IsString()
  zoneName: string;

  @IsString()
  @IsIn([
    'DEEP_FROZEN',
    'FROZEN',
    'CHILLED',
    'CONTROLLED_AMBIENT',
  ])
  temperatureBand: string;

  @Type(() => Number)
  @IsNumber()
  targetTemperatureCelsius: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  volumeSharePercent: number;
}

export class CompartmentLayoutDto {
  @Transform(toBoolean)
  @IsBoolean()
  isMultiCompartment: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => CompartmentItemDto)
  compartments: CompartmentItemDto[];

  @Transform(toBoolean)
  @IsBoolean()
  isAirflowClearanceVerified: boolean;
}
