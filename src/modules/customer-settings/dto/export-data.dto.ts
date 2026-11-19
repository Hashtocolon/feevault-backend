import { IsIn, IsString } from 'class-validator';

export class ExportDataDto {
  @IsString()
  @IsIn(['zip_json_csv'])
  format: string;

  @IsString()
  @IsIn(['email_link'])
  deliveryChannel: string;
}