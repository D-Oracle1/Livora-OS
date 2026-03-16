import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * GET /api/v1/search?q=keyword&limit=10
   * Platform-wide search across properties, users, clients, realtors, staff, and sales.
   * Results are scoped to the caller's role — ADMIN sees more than CLIENT.
   */
  @Get()
  @ApiOperation({ summary: 'Global platform search across all entities' })
  @ApiQuery({ name: 'q', description: 'Search keyword (min 2 chars)', required: true })
  @ApiQuery({ name: 'limit', description: 'Max results per category (max 25)', required: false })
  async search(
    @Query('q') q: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @CurrentUser() user: any,
  ) {
    if (!q || q.trim().length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }
    return this.searchService.globalSearch(q.trim(), limit, user.role);
  }
}
