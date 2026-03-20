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

@Controller('raffle')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'GENERAL_OVERSEER', 'SUPER_ADMIN')
export class RaffleController {
  constructor(private readonly raffleService: RaffleService) {}

  @Post()
  create(@Body() dto: CreateRaffleDto, @Request() req: any) {
    return this.raffleService.create(dto, req.user.id);
  }

  @Get()
  findAll() {
    return this.raffleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.raffleService.findOne(id);
  }

  @Get(':id/preview')
  preview(@Param('id') id: string) {
    return this.raffleService.previewEligible(id);
  }

  @Post(':id/send')
  send(@Param('id') id: string) {
    return this.raffleService.send(id);
  }

  @Get(':id/codes')
  getCodes(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.raffleService.getCodes(id, page, limit);
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string) {
    return this.raffleService.completeSession(id);
  }

  @Patch('codes/:code/redeem')
  redeem(@Param('code') code: string) {
    return this.raffleService.markRedeemed(code);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.raffleService.remove(id);
  }
}
