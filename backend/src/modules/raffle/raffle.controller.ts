import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  Patch,
} from '@nestjs/common';
import { RaffleService } from './raffle.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// All raffle routes require authentication
@Controller('raffle')
@UseGuards(JwtAuthGuard)
export class RaffleController {
  constructor(private readonly raffleService: RaffleService) {}

  // ── User-facing (any authenticated role) ─────────────────────────────────

  /** Returns all published raffle codes the requesting user has received */
  @Get('my-active-code')
  getMyActiveCode(@Request() req: any) {
    return this.raffleService.getMyActiveCode(req.user.id);
  }

  // ── Admin-only ────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  create(@Body() dto: CreateRaffleDto, @Request() req: any) {
    return this.raffleService.create(dto, req.user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  findAll() {
    return this.raffleService.findAll();
  }

  @Patch('codes/:code/redeem')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  redeem(@Param('code') code: string) {
    return this.raffleService.markRedeemed(code);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  findOne(@Param('id') id: string) {
    return this.raffleService.findOne(id);
  }

  @Get(':id/preview')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  preview(@Param('id') id: string) {
    return this.raffleService.previewEligible(id);
  }

  @Get(':id/codes')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  getCodes(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.raffleService.getCodes(id, page, limit);
  }

  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  send(@Param('id') id: string) {
    return this.raffleService.send(id);
  }

  @Patch(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  publish(@Param('id') id: string) {
    return this.raffleService.publishSession(id);
  }

  @Patch(':id/unpublish')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  unpublish(@Param('id') id: string) {
    return this.raffleService.unpublishSession(id);
  }

  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  complete(@Param('id') id: string) {
    return this.raffleService.completeSession(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.raffleService.remove(id);
  }
}
