import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

export class ExportStatementDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Month must be in YYYY-MM format',
  })
  month: string;

  @IsString()
  @IsIn(['PDF', 'CSV'])
  format: 'PDF' | 'CSV';
}