
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

import { AdminRegisterDto } from './dto/admin-register.dto';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getPermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      SUPER_ADMIN: [
        'DISPATCH_OVERRIDE',
        'APPROVE_CREDIT',
        'FINANCE_DISBURSE',
      ],
      OPS_DISPATCHER: ['DISPATCH_OVERRIDE'],
      FINANCE_ADMIN: ['FINANCE_DISBURSE'],
      CREDIT_MANAGER: ['APPROVE_CREDIT'],
    };

    return permissions[role] ?? [];
  }

  private async createAccessToken(admin: {
    id: string;
    email: string;
    role: string;
  }): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        tokenType: 'admin',
      },
      {
        secret: process.env.ADMIN_JWT_ACCESS_SECRET,
        expiresIn: '1h',
      },
    );
  }

  // API 1.1 - Admin Registration
  async register(dto: AdminRegisterDto) {
    if (dto.password !== dto.confirm) {
      throw new BadRequestException('Passwords do not match');
    }

    const existing = await this.db.query(
      `SELECT id FROM admin_users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [dto.email],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException('Admin email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO admin_users
         (name, email, password_hash, role)
         VALUES ($1, LOWER($2), $3, $4)
         RETURNING id, name, email, role`,
        [dto.name, dto.email, passwordHash, 'OPS_DISPATCHER'],
      );

      const admin = result.rows[0];

      const payload = {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        tokenType: 'admin',
      };

      const accessToken = await this.jwtService.signAsync(payload, {
        secret: process.env.ADMIN_JWT_ACCESS_SECRET,
        expiresIn: '1h',
      });

      const refreshToken = await this.jwtService.signAsync(payload, {
        secret: process.env.ADMIN_JWT_REFRESH_SECRET,
        expiresIn: '7d',
      });

      await client.query(
        `INSERT INTO admin_refresh_tokens
         (admin_user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
        [admin.id, this.hashToken(refreshToken)],
      );

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Admin registered successfully',
        admin,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // API 1.2 - Admin Login
  async login(dto: AdminLoginDto) {
    const result = await this.db.query(
      `SELECT id, name, email, password_hash, role, is_active
       FROM admin_users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [dto.email],
    );

    const admin = result.rows[0];

    if (!admin || !admin.is_active) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      admin.password_hash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      tokenType: 'admin',
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.ADMIN_JWT_ACCESS_SECRET,
      expiresIn: '1h',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.ADMIN_JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    await this.db.query(
      `INSERT INTO admin_refresh_tokens
       (admin_user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [admin.id, this.hashToken(refreshToken)],
    );

    return {
      success: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      accessToken,
      refreshToken,
    };
  }

  // API 1.3 - Get Admin Profile
  async getProfile(adminId: string) {
    const result = await this.db.query(
      `SELECT id, name, email, role, is_active
       FROM admin_users
       WHERE id = $1
       LIMIT 1`,
      [adminId],
    );

    const admin = result.rows[0];

    if (!admin || !admin.is_active) {
      throw new UnauthorizedException(
        'Admin account not found or inactive',
      );
    }

    const nameParts = admin.name.trim().split(/\s+/);

    const initials =
      nameParts.length > 1
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
        : nameParts[0].slice(0, 2);

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      initials: initials.toUpperCase(),
      role: admin.role,
      permissions: this.getPermissions(admin.role),
    };
  }

  // API 1.5 - Admin Logout
async logout(adminId: string) {
  await this.db.query(
    `UPDATE admin_refresh_tokens
     SET revoked_at = NOW()
     WHERE admin_user_id = $1
       AND revoked_at IS NULL`,
    [adminId],
  );

  return {
    success: true,
    message: 'Successfully logged out',
  };
}

  // API 1.4 - Refresh Access Token
  async refreshAccessToken(refreshToken: string) {
    let payload: any;

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.ADMIN_JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired refresh token',
      );
    }

    if (payload.tokenType !== 'admin' || !payload.sub) {
      throw new UnauthorizedException('Invalid admin refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);

    const result = await this.db.query(
      `SELECT
         rt.id,
         au.id AS admin_id,
         au.email,
         au.role
       FROM admin_refresh_tokens rt
       INNER JOIN admin_users au
         ON au.id = rt.admin_user_id
       WHERE rt.token_hash = $1
         AND rt.revoked_at IS NULL
         AND rt.expires_at > NOW()
         AND au.is_active = TRUE
       LIMIT 1`,
      [tokenHash],
    );

    const session = result.rows[0];

    if (!session || session.admin_id !== payload.sub) {
      throw new UnauthorizedException(
        'Refresh session is invalid or expired',
      );
    }

    const accessToken = await this.createAccessToken({
      id: session.admin_id,
      email: session.email,
      role: session.role,
    });

    return { accessToken };
  }
}
