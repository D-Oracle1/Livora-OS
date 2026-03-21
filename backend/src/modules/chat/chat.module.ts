import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { VoiceService } from './voice.service';
import { CrmService } from './crm.service';

@Module({
  imports: [
    // Store uploaded audio files in memory so VoiceService can read the buffer
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [ChatController],
  providers: [ChatService, VoiceService, CrmService],
  exports: [ChatService, CrmService],
})
export class ChatModule {}
