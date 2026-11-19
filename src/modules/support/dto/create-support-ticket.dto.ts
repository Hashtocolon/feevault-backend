
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  shipmentNumber?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'shipment_status',
    'temperature_query',
    'invoice_correction',
    'booking_issue',
    'other',
  ])
  issueCategory: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;
}
