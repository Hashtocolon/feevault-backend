import {
  IsIn,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class CreatePayoutBatchDto {
  @IsString()
  @IsNotEmpty()
  settlementPeriod: string;

  @IsString()
  @IsIn(['Weekly', 'Monthly', 'Daily'])
  payoutCycle: string;

  @IsString()
  @IsIn([
    'RazorpayX',
    'Cashfree',
    'Direct Bank Transfer',
  ])
  payoutProvider: string;
}