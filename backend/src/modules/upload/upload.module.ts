import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { CdnService } from './cdn.service';
import { DatabaseModule } from '../../database/database.module';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

@Module({
  imports: [
    DatabaseModule,
    MulterModule.register({
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'avatars'),
        filename: (
          _req: Request,
          file: MulterFile,
          callback: (error: Error | null, filename: string) => void,
        ) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (
        _req: Request,
        file: MulterFile,
        callback: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          callback(new Error('Only image files are allowed!'), false);
          return;
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, CdnService],
  exports: [UploadService, CdnService],
})
export class UploadModule {}
