import { IsString } from 'class-validator';

export class FailedDeliveryDecisionDto {
  @IsString()
  decision: string; // 'RETURN' | 'REDELIVER' | 'DISPOSE'

  @IsString()
  reason: string;
}

