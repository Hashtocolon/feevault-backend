
import {
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';

export class UpdateConsentDto {
  @IsBoolean()
  @IsNotEmpty()
  locationWhileOnline: boolean;

  @IsBoolean()
  @IsNotEmpty()
  backgroundLocationDuringTrip: boolean;

  @IsBoolean()
  @IsNotEmpty()
  pushNotifications: boolean;

  @IsBoolean()
  @IsNotEmpty()
  whatsappUpdates: boolean;
}
