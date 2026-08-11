import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { AuthenticatedUser, LoginResponse } from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { TokenService } from './token.service';

/**
 * D15/D20 — web users log in with a globally unique email; drivers (who often have no
 * work email) log in with company code + username. Both paths converge on the same user
 * table, the same password hasher, and the same token issuer.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async loginWithEmail(email: string, password: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return this.completeLogin(user, password);
  }

  async loginAsDriver(
    companyCode: string,
    username: string,
    password: string,
  ): Promise<LoginResponse> {
    const company = await this.prisma.company.findUnique({ where: { slug: companyCode } });
    if (!company) throw new UnauthorizedException('Invalid credentials.');

    const user = await this.prisma.user.findUnique({
      where: { companyId_username: { companyId: company.id, username } },
    });
    return this.completeLogin(user, password);
  }

  async refresh(rawToken: string): Promise<LoginResponse> {
    const tokenHash = this.tokens.hashRefreshToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) throw new UnauthorizedException('Invalid refresh token.');

    if (stored.revokedAt) {
      // A previously used (and revoked) token being replayed is a theft signal (D9 in
      // ROADMAP.md §4.1) — revoke every remaining session for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token has already been used.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is disabled.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(user);
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect.');

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  private async completeLogin(
    user: { id: string; passwordHash: string; status: string } | null,
    password: string,
  ): Promise<LoginResponse> {
    if (!user) throw new UnauthorizedException('Invalid credentials.');

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials.');

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is disabled.');

    const full = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueSession(full);
  }

  private async issueSession(user: {
    id: string;
    companyId: string | null;
    role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'OPERATOR' | 'DRIVER';
    name: string;
    email: string | null;
    username: string | null;
    mustChangePassword: boolean;
  }): Promise<LoginResponse> {
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
    });

    const refresh = this.tokens.issueRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.tokenHash,
        expiresAt: refresh.expiresAt,
      },
    });

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      companyId: user.companyId,
      role: user.role,
      name: user.name,
      email: user.email,
      username: user.username,
      mustChangePassword: user.mustChangePassword,
    };

    return {
      tokens: { accessToken, refreshToken: refresh.token },
      user: authenticatedUser,
    };
  }
}
