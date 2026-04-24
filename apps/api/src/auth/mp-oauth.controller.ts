import { Controller, Get, Query, Res, Req, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MpOAuthService } from './mp-oauth.service';

@Controller('auth/mp')
export class MpOAuthController {
  constructor(private readonly mpOAuth: MpOAuthService) {}

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  connect(@Req() req: Request) {
    const tenantId = (req.user as any).tenantId;
    const url = this.mpOAuth.buildAuthorizationUrl(tenantId);
    return { url };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:5173';
    try {
      await this.mpOAuth.handleCallback(code, state);
      res.redirect(`${dashboardUrl}/settings?mp=connected`);
    } catch {
      res.redirect(`${dashboardUrl}/settings?mp=error`);
    }
  }
}
