import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MasterSupportService } from './master-support.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class SendMessageDto {
  @ApiProperty({ example: 'Hello, I need help with...' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

@ApiTags('Master Support')
@Controller('master/support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class MasterSupportController {
  constructor(private readonly service: MasterSupportService) {}

  /**
   * Admin: get or create their company's support thread with super admin
   */
  @Get('thread')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Get or create support thread for this company' })
  @ApiResponse({ status: 200, description: 'Support thread' })
  async getThread(
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.service.getOrCreateThread(user.companyId);
  }

  /**
   * Admin/Super admin: get messages for a thread
   */
  @Get('thread/:threadId/messages')
  @ApiOperation({ summary: 'Get messages for a support thread' })
  @ApiResponse({ status: 200, description: 'Messages list' })
  async getMessages(
    @Param('threadId') threadId: string,
    @CurrentUser() user: { id: string; role: string; companyId?: string },
  ) {
    const companyId = user.role === 'SUPER_ADMIN' ? undefined : user.companyId;
    return this.service.getMessages(threadId, companyId);
  }

  /**
   * Admin/Super admin: send a message in a thread
   */
  @Post('thread/:threadId/messages')
  @ApiOperation({ summary: 'Send a message in a support thread' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async sendMessage(
    @Param('threadId') threadId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: { id: string; role: string; firstName: string; lastName: string; companyId?: string },
  ) {
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const senderType = isSuperAdmin ? 'super_admin' : 'company_admin';
    const companyId = isSuperAdmin ? undefined : user.companyId;
    const senderName = `${user.firstName} ${user.lastName}`;
    return this.service.sendMessage(threadId, dto.content, senderType, user.id, senderName, companyId);
  }

  /**
   * Super admin: list all company support threads
   */
  @Get('threads')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all support threads (super admin only)' })
  @ApiResponse({ status: 200, description: 'All support threads' })
  async getAllThreads() {
    return this.service.getAllThreads();
  }

  /**
   * Super admin: mark a thread as resolved
   */
  @Patch('thread/:threadId/resolve')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Mark support thread as resolved' })
  @ApiResponse({ status: 200, description: 'Thread resolved' })
  async resolveThread(@Param('threadId') threadId: string) {
    return this.service.markThreadResolved(threadId);
  }
}
