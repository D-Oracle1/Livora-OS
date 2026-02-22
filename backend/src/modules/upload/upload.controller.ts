import {
  Controller,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { memoryStorage } from 'multer';
import { Request } from 'express';

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

const imageFileFilter = (
  _req: Request,
  file: MulterFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
    callback(new Error('Only image files are allowed!'), false);
    return;
  }
  callback(null, true);
};

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  async uploadAvatar(
    @UploadedFile() file: MulterFile,
    @Req() req: Request & { user: { id: string; companyId?: string } },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.uploadService.updateUserAvatar(req.user.id, file, req.user.companyId);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Delete user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar deleted successfully' })
  async deleteAvatar(@Req() req: Request & { user: { id: string; companyId?: string } }) {
    return this.uploadService.deleteUserAvatar(req.user.id, req.user.companyId);
  }

  @Post('property-images')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload property images' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Images uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid files' })
  async uploadPropertyImages(@UploadedFiles() files: MulterFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const urls = await this.uploadService.uploadPropertyImages(files);
    return { urls };
  }

  @Post('gallery-images')
  @UseInterceptors(
    FilesInterceptor('images', 20, {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload gallery images' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Gallery images uploaded' })
  async uploadGalleryImages(@UploadedFiles() files: MulterFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    const urls = await this.uploadService.uploadGalleryFiles(files);
    return { urls };
  }

  @Post('gallery-videos')
  @UseInterceptors(
    FilesInterceptor('videos', 5, {
      storage: memoryStorage(),
      fileFilter: (
        _req: Request,
        file: MulterFile,
        callback: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        if (!file.mimetype.match(/^video\/(mp4|webm|mov|quicktime|x-msvideo|avi)$/)) {
          callback(new Error('Only video files are allowed!'), false);
          return;
        }
        callback(null, true);
      },
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload gallery videos' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Gallery videos uploaded' })
  async uploadGalleryVideos(@UploadedFiles() files: MulterFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    const urls = await this.uploadService.uploadGalleryFiles(files);
    return { urls };
  }

  @Post('cms-images')
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload CMS images' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'CMS images uploaded' })
  async uploadCmsImages(@UploadedFiles() files: MulterFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    const urls = await this.uploadService.uploadCmsFiles(files);
    return { urls };
  }

  @Post('company-logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload a company logo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { logo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Logo uploaded' })
  async uploadCompanyLogo(@UploadedFile() file: MulterFile) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadService.uploadCompanyLogo(file);
  }

  @Post('task-files')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload task report files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task files uploaded' })
  async uploadTaskFiles(@UploadedFiles() files: MulterFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    const urls = await this.uploadService.uploadTaskFiles(files);
    return { urls };
  }
}
