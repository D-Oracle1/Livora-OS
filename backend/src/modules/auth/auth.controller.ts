import {
  Controller,
  Post,
  Patch,
  Body,
  UseGuards,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  HttpException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { TwoFaService } from './twofa.service';
import { OAuthService } from './oauth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EnableTwoFaDto, VerifyTwoFaDto, DisableTwoFaDto, RecoveryCodeDto } from './dto/twofa.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFaService: TwoFaService,
    private readonly oauthService: OAuthService,
  ) {}

  @Post('register')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    const companyId = req.tenant?.companyId || null;
    return this.authService.register(registerDto, companyId);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const companyId = req.tenant?.companyId || null;
    return this.authService.login(loginDto, companyId);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser('id') userId: string,
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.authService.logout(userId, refreshToken);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  @Get('verify-email')
  @Public()
  @ApiOperation({ summary: 'Verify email address using token from email link (legacy)' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmailGet(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address using OTP code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyEmailOtp(@Body('email') email: string, @Body('otp') otp: string) {
    return this.authService.verifyEmailOtp(email, otp);
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({ status: 200, description: 'Verification email sent if account exists and is unverified' })
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerification(email);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'Password reset email sent if account exists' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  @Get('my-referrals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get users referred by the current user' })
  @ApiResponse({ status: 200, description: 'Referrals retrieved successfully' })
  async getMyReferrals(@CurrentUser('id') userId: string) {
    return this.authService.getMyReferrals(userId);
  }

  @Get('all-referrals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all referral data (admin only)' })
  @ApiResponse({ status: 200, description: 'All referrals retrieved successfully' })
  async getAllReferrals(@CurrentUser('role') role: string) {
    if (!['ADMIN', 'SUPER_ADMIN', 'GENERAL_OVERSEER'].includes(role)) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    return this.authService.getAllReferrals();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@CurrentUser() user: any) {
    // SUPER_ADMIN profile comes from master DB
    if (user.isSuperAdmin) {
      return this.authService.getSuperAdminProfile(user.id);
    }
    return this.authService.getProfile(user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateDto: UpdateUserDto,
  ) {
    return this.authService.updateProfile(user.id, updateDto, user.isSuperAdmin);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Two-Factor Authentication (2FA / TOTP)
  // ──────────────────────────────────────────────────────────────────────────

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current 2FA status for the authenticated user' })
  async getTwoFaStatus(@CurrentUser('id') userId: string) {
    return this.twoFaService.getStatus(userId);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate TOTP secret + QR code URI for authenticator app' })
  @ApiResponse({ status: 200, description: 'Secret and QR code URL returned' })
  async setupTwoFa(@CurrentUser('id') userId: string) {
    return this.twoFaService.generateSetupData(userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable 2FA after confirming with authenticator code' })
  @ApiResponse({ status: 200, description: '2FA enabled; backup codes returned' })
  async enableTwoFa(
    @CurrentUser('id') userId: string,
    @Body() dto: EnableTwoFaDto,
  ) {
    return this.twoFaService.enable(userId, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA (requires current authenticator code)' })
  async disableTwoFa(
    @CurrentUser('id') userId: string,
    @Body() dto: DisableTwoFaDto,
  ) {
    return this.twoFaService.disable(userId, dto.code);
  }

  @Post('2fa/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP code during login flow' })
  async verifyTwoFa(
    @Body('userId') userId: string,
    @Body() dto: VerifyTwoFaDto,
  ) {
    const valid = await this.twoFaService.verifyForLogin(userId, dto.code);
    if (!valid) throw new HttpException('Invalid 2FA code', HttpStatus.UNAUTHORIZED);
    return { verified: true };
  }

  @Post('2fa/recovery')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Use a one-time recovery code in place of TOTP (consumes the code)' })
  async useTwoFaRecovery(
    @Body('userId') userId: string,
    @Body() dto: RecoveryCodeDto,
  ) {
    const valid = await this.twoFaService.verifyRecoveryCode(userId, dto.recoveryCode);
    if (!valid) throw new HttpException('Invalid recovery code', HttpStatus.UNAUTHORIZED);
    return { verified: true };
  }

  @Post('2fa/regenerate-backup-codes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate backup/recovery codes (requires current authenticator code)' })
  async regenerateBackupCodes(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyTwoFaDto,
  ) {
    return this.twoFaService.regenerateBackupCodes(userId, dto.code);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Google OAuth
  // ──────────────────────────────────────────────────────────────────────────

  @Get('google')
  @Public()
  @ApiOperation({ summary: 'Redirect to Google OAuth consent screen' })
  async googleAuth(@Req() req: Request, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return (res as any).redirect(`${frontendUrl}/auth/login?error=oauth_not_configured`);
    }
    try {
      const passport = require('passport');
      passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res);
    } catch {
      return (res as any).redirect(`${frontendUrl}/auth/login?error=oauth_not_configured`);
    }
  }

  @Get('google/callback')
  @Public()
  @ApiOperation({ summary: 'Google OAuth callback — issues JWT after successful authentication' })
  async googleCallback(@Req() req: any, @Res() res: Response) {
    try {
      const passport = require('passport');
      passport.authenticate('google', { session: false }, async (err: any, profile: any) => {
        if (err || !profile) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          return res.redirect(`${frontendUrl}/auth/login?error=oauth_failed`);
        }
        try {
          const companyId = req.tenant?.companyId ?? null;
          const result = await this.oauthService.findOrCreateUser(profile, companyId);
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const params = new URLSearchParams({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          });
          res.redirect(`${frontendUrl}/auth/oauth-callback?${params.toString()}`);
        } catch (e: any) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          res.redirect(`${frontendUrl}/auth/login?error=oauth_error`);
        }
      })(req, res);
    } catch {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return (res as any).redirect(`${frontendUrl}/auth/login?error=oauth_not_configured`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Facebook OAuth
  // ──────────────────────────────────────────────────────────────────────────

  @Get('facebook')
  @Public()
  @ApiOperation({ summary: 'Redirect to Facebook OAuth consent screen' })
  async facebookAuth(@Req() req: Request, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
      return (res as any).redirect(`${frontendUrl}/auth/login?error=oauth_not_configured`);
    }
    try {
      const passport = require('passport');
      passport.authenticate('facebook', { scope: ['email'], session: false })(req, res);
    } catch {
      return (res as any).redirect(`${frontendUrl}/auth/login?error=oauth_not_configured`);
    }
  }

  @Get('facebook/callback')
  @Public()
  @ApiOperation({ summary: 'Facebook OAuth callback — issues JWT after successful authentication' })
  async facebookCallback(@Req() req: any, @Res() res: Response) {
    try {
      const passport = require('passport');
      passport.authenticate('facebook', { session: false }, async (err: any, profile: any) => {
        if (err || !profile) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          return res.redirect(`${frontendUrl}/auth/login?error=oauth_failed`);
        }
        try {
          const companyId = req.tenant?.companyId ?? null;
          const result = await this.oauthService.findOrCreateUser(profile, companyId);
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const params = new URLSearchParams({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          });
          res.redirect(`${frontendUrl}/auth/oauth-callback?${params.toString()}`);
        } catch {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          res.redirect(`${frontendUrl}/auth/login?error=oauth_error`);
        }
      })(req, res);
    } catch {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return (res as any).redirect(`${frontendUrl}/auth/login?error=oauth_not_configured`);
    }
  }
}
