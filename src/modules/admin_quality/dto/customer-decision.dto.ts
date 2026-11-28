import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class CustomerDecisionDto {
  @IsString()
  @IsNotEmpty()
  tripReference: string;

  @IsString()
  @IsNotEmpty()
  decision: string;

  @IsString()
  @IsNotEmpty()
  customerInstruction: string;
}