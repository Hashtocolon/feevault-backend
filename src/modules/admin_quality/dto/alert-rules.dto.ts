import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class AlertRulesDto {
  @IsString()
  @IsNotEmpty()
  cargoCategory: string;

  @IsInt()
  @Min(0)
  warningDurationMin: number;

  @IsInt()
  @Min(1)
  criticalDurationMin: number;

  @IsInt()
  @Min(0)
  doorOpenGraceMin: number;

  @IsString()
  @IsNotEmpty()
  defrostCycleWindow: string;

  @IsString()
  @IsIn(['Both', 'Supply', 'Return'])
  probeType: string;
}