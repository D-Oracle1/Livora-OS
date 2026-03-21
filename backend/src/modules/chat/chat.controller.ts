import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CrmService } from './crm.service';
import { VoiceService } from './voice.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MessageType } from '@prisma/client';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly crmService: CrmService,
    private readonly voiceService: VoiceService,
  ) {}

  // ── User / Contact Discovery ──────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'Search users for chat (role-scoped)' })
  @ApiQuery({ name: 'search', required: true, type: String })
  @ApiResponse({ status: 200, description: 'List of users matching search within role scope' })
  async searchUsers(
    @CurrentUser() user: { id: string; role: string },
    @Query('search') search: string,
  ) {
    return this.chatService.searchUsers(user.id, user.role, search);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Get available chat contacts (role-scoped)' })
  @ApiResponse({ status: 200, description: 'List of contacts grouped by role' })
  async getContacts(@CurrentUser() user: { id: string; role: string }) {
    return this.chatService.getContacts(user.id, user.role);
  }

  // ── Support Chat ──────────────────────────────────────────────────────────

  @Post('support/start')
  @ApiOperation({ summary: 'Start or get existing support chat' })
  @ApiResponse({ status: 201, description: 'Support chat room returned' })
  async startSupportChat(@CurrentUser('id') userId: string) {
    return this.chatService.startSupportChat(userId);
  }

  @Get('support/rooms')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Get all support chat rooms (admin only)' })
  @ApiResponse({ status: 200, description: 'List of support chat rooms' })
  async getSupportRooms() {
    return this.chatService.getSupportRooms();
  }

  // ── CRM Intelligence (admin only) ─────────────────────────────────────────

  @Get('crm/hot-leads')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER', 'REALTOR')
  @ApiOperation({ summary: 'Hot leads: high engagement, contacted recently' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Hot leads list' })
  async getHotLeads(@Query('limit') limit?: number) {
    return this.crmService.getHotLeads(limit ? Number(limit) : 20);
  }

  @Get('crm/cold-leads')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER', 'REALTOR')
  @ApiOperation({ summary: 'Cold leads: no recent contact or low engagement' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Cold leads list' })
  async getColdLeads(@Query('limit') limit?: number) {
    return this.crmService.getColdLeads(limit ? Number(limit) : 20);
  }

  @Get('crm/follow-ups')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER', 'REALTOR')
  @ApiOperation({ summary: 'Pending follow-ups: warm window 3–13 days' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Follow-ups list' })
  async getPendingFollowUps(@Query('limit') limit?: number) {
    return this.crmService.getPendingFollowUps(limit ? Number(limit) : 20);
  }

  @Get('crm/client/:clientId')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER', 'REALTOR')
  @ApiOperation({ summary: 'Full CRM profile for a client' })
  @ApiResponse({ status: 200, description: 'Client CRM profile with recent activities' })
  async getClientCrmProfile(@Param('clientId') clientId: string) {
    return this.crmService.getClientProfile(clientId);
  }

  @Get('crm/client/:clientId/activities')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER', 'REALTOR')
  @ApiOperation({ summary: 'Activity feed for a client' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'CRM activity list' })
  async getClientActivities(
    @Param('clientId') clientId: string,
    @Query('limit') limit?: number,
  ) {
    return this.crmService.getActivities(clientId, limit ? Number(limit) : 20);
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  @Get('rooms')
  @ApiOperation({ summary: 'Get user chat rooms' })
  @ApiResponse({ status: 200, description: 'List of chat rooms' })
  async getRooms(@CurrentUser('id') userId: string) {
    return this.chatService.getRooms(userId);
  }

  @Post('rooms')
  @ApiOperation({ summary: 'Create a chat room' })
  @ApiResponse({ status: 201, description: 'Chat room created' })
  async createRoom(
    @CurrentUser('id') userId: string,
    @Body() data: { participantIds: string[]; name?: string },
  ) {
    return this.chatService.createRoom(userId, data.participantIds, data.name);
  }

  @Get('rooms/:roomId')
  @ApiOperation({ summary: 'Get chat room details' })
  @ApiResponse({ status: 200, description: 'Chat room details' })
  async getRoom(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.getRoom(roomId, userId);
  }

  @Delete('rooms/:roomId')
  @ApiOperation({ summary: 'Delete chat room' })
  @ApiResponse({ status: 200, description: 'Chat room deleted' })
  async deleteRoom(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.deleteRoom(roomId, userId);
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Get chat room messages (cursor-based pagination)' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'ISO timestamp — load messages older than this' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Chat messages' })
  async getMessages(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getMessages(roomId, userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Send a text message' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async sendMessage(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
    @Body() data: { content: string; type?: MessageType; attachments?: any[] },
  ) {
    return this.chatService.sendMessage(roomId, userId, data);
  }

  @Post('rooms/:roomId/voice')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload and send a voice note' })
  @ApiResponse({ status: 201, description: 'Voice message sent' })
  async sendVoiceMessage(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('duration') duration: string,
  ) {
    if (!file) throw new BadRequestException('Audio file is required');
    const durationSeconds = parseFloat(duration ?? '0');
    const voiceData = await this.voiceService.uploadVoiceNote(
      file.buffer,
      file.originalname,
      file.mimetype,
      durationSeconds,
    );
    return this.chatService.sendVoiceMessage(roomId, userId, voiceData);
  }

  @Post('rooms/:roomId/typing')
  @ApiOperation({ summary: 'Broadcast typing indicator' })
  @ApiResponse({ status: 200, description: 'Typing indicator broadcast' })
  async broadcastTyping(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.chatService.broadcastTyping(roomId, userId, true);
    return { ok: true };
  }

  @Post('rooms/:roomId/read')
  @ApiOperation({ summary: 'Mark messages as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markAsRead(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.markAsRead(roomId, userId);
  }

  // ── Participants ──────────────────────────────────────────────────────────

  @Post('rooms/:roomId/participants')
  @ApiOperation({ summary: 'Add participants to group chat' })
  @ApiResponse({ status: 200, description: 'Participants added' })
  async addParticipants(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
    @Body() data: { participantIds: string[] },
  ) {
    return this.chatService.addParticipants(roomId, userId, data.participantIds);
  }

  @Delete('rooms/:roomId/participants/:participantId')
  @ApiOperation({ summary: 'Remove participant from group chat' })
  @ApiResponse({ status: 200, description: 'Participant removed' })
  async removeParticipant(
    @Param('roomId') roomId: string,
    @Param('participantId') participantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.removeParticipant(roomId, userId, participantId);
  }
}
