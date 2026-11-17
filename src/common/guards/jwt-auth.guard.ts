import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access token missing or invalid format');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'zoop-jwt-super-secret-key-2026';

    try {
      const decoded = jwt.verify(token, secret);
      request.user = decoded;
      return true;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access token has expired');
      }
      throw new UnauthorizedException('Invalid access token');
    }
  }
}

