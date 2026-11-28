import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignDriverDto {
  // Send a driver ID to assign, or null to unassign.
  driverId: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  assignmentRemarks?: string;
}