
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsString,
  Length,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MaxLength(200)
  legalBusinessName: string;

  @IsString()
  @Length(15, 15)
  gstin: string;

  @IsString()
  @Length(10, 10)
  pan: string;

  @IsEmail()
  billingEmail: string;

  @IsNumber()
  @Min(0)
  creditLimitInr: number;

  @IsIn(['Prepaid', 'Net 7', 'Net 15', 'Net 30'])
  paymentTerms: string;
}
