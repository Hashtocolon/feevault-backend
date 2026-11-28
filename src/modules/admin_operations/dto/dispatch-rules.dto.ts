import {
  IsInt,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class DispatchRulesDto {
  @IsInt()
  @Min(1)
  @Max(100)
  wave1VehicleCount: number;

  @IsInt()
  @Min(1)
  @Max(3600)
  wave1TimeoutSeconds: number;

  @IsInt()
  @Min(1)
  @Max(100)
  wave2VehicleCount: number;

  @IsInt()
  @Min(1)
  @Max(3600)
  wave2TimeoutSeconds: number;

  @IsInt()
  @Min(1)
  @Max(20)
  escalationAfterRounds: number;

  @IsNumber()
  @Min(0)
  hardLaneIncentiveInr: number;
}