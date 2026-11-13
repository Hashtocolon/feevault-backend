import { IsString, IsOptional } from 'class-validator';

export class CreateCreditRequestDto {
  @IsString()
  customerId: string;

  @IsString()
  @IsOptional()
  creditLimit?: string;

  @IsString()
  @IsOptional()
  requestNote?: string;
}

export class LinkMasterContractDto {
  @IsString()
  contractId: string;

  @IsString()
  customerId: string;
}

