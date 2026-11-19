
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class SubmitBankDetailsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  accountHolderName: string;

  @IsString()
  @Matches(/^\d{8,18}$/, {
    message: 'Account number must contain 8 to 18 digits',
  })
  accountNumber: string;

  @IsString()
  @Matches(/^\d{8,18}$/, {
    message: 'Confirm account number must contain 8 to 18 digits',
  })
  confirmAccountNumber: string;

  @IsString()
  @Length(11, 11)
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/i, {
    message: 'Please enter a valid IFSC code',
  })
  ifscCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/, {
    message: 'Please enter a valid UPI ID',
  })
  upiId?: string;
}
