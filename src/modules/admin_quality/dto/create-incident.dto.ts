import {
  IsIn,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class CreateIncidentDto {
  @IsString()
  @IsIn([
    'Reefer failure',
    'Breakdown',
    'Accident',
    'Theft / hijack',
    'Medical',
    'Excursion',
    'GPS disconnect',
  ])
  incidentType: string;

  @IsString()
  @IsNotEmpty()
  tripReference: string;

  @IsString()
  @IsIn(['Critical', 'High', 'Medium', 'Low'])
  severity: string;

  @IsString()
  @IsIn([
    'Ops duty desk',
    'Quality head',
    '24/7 duty manager',
  ])
  assignedResponse: string;

  @IsString()
  @IsNotEmpty()
  currentLocation: string;

  @IsString()
  @IsNotEmpty()
  incidentDetails: string;
}