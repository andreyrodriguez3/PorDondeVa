import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordRequestSchema,
  driverLoginRequestSchema,
  refreshRequestSchema,
  webLoginRequestSchema,
  type ChangePasswordRequest,
  type DriverLoginRequest,
  type RefreshRequest,
  type WebLoginRequest,
} from '@tubus/contracts';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import type { JwtPayload } from './token.service';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body(new ZodValidationPipe(webLoginRequestSchema)) body: WebLoginRequest) {
    return this.auth.loginWithEmail(body.email, body.password);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('driver/login')
  driverLogin(@Body(new ZodValidationPipe(driverLoginRequestSchema)) body: DriverLoginRequest) {
    return this.auth.loginAsDriver(body.companyCode, body.username, body.password);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(refreshRequestSchema)) body: RefreshRequest) {
    return this.auth.refresh(body.refreshToken);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body(new ZodValidationPipe(refreshRequestSchema)) body: RefreshRequest) {
    await this.auth.logout(body.refreshToken);
  }

  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const record = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!record) return null;
    return {
      id: record.id,
      companyId: record.companyId,
      role: record.role,
      name: record.name,
      email: record.email,
      username: record.username,
      mustChangePassword: record.mustChangePassword,
    };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(changePasswordRequestSchema)) body: ChangePasswordRequest,
  ) {
    await this.auth.changePassword(user.sub, body.currentPassword, body.newPassword);
  }
}
