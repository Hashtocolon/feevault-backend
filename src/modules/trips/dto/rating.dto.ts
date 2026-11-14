import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RateTripDto {
  @IsInt()
  @Min(1)
  @Max(5)
  ratingStars: number;

  @IsIn(['grade_a', 'grade_b', 'grade_c'])
  hygieneGradeObserved: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  feedback?: string;
}
