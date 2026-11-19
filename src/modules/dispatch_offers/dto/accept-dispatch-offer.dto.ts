
import {
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class AcceptDispatchOfferDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  acceptedAtLatitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  acceptedAtLongitude: number;
}
