import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { Role } from '@tubus/contracts';

export interface JwtPayload {
  sub: string;
  companyId: string | null;
  role: Role;
}

export interface IssuedRefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Signs access tokens and issues opaque refresh tokens. Refresh tokens are stored as a
 * sha-256 hash (D9 in ROADMAP.md §4.1 refresh_tokens) — the raw value is never persisted,
 * so a database leak does not hand out usable sessions.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('ACCESS_TOKEN_TTL'),
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  issueRefreshToken(): IssuedRefreshToken {
    const token = randomUUID() + randomUUID();
    const ttl = this.parseRefreshTtlMs();
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + ttl),
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseRefreshTtlMs(): number {
    const ttl = this.config.get<string>('REFRESH_TOKEN_TTL') ?? '30d';
    const unitMsByLetter: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const [, amount, unit] = match;
    return Number(amount) * (unitMsByLetter[unit!] ?? 86_400_000);
  }
}
