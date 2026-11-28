import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSegregationRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  cargoA: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  cargoB: string;

  @IsString()
  @IsNotEmpty()
  compatibility: string;

  @IsString()
  @IsNotEmpty()
  condition: string;
}