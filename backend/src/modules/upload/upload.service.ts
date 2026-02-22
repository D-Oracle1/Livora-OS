import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { put, del } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

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

@Injectable()
export class UploadService {
  constructor(private readonly prisma: PrismaService) {}

  private async uploadToBlob(
    file: MulterFile,
    folder: string,
  ): Promise<string> {
    const ext = extname(file.originalname);
    const pathname = `${folder}/${uuidv4()}${ext}`;
    const blob = await put(pathname, file.buffer, { access: 'public' });
    return blob.url;
  }

  private async deleteFromBlob(url: string): Promise<void> {
    try {
      if (url && url.startsWith('https://')) {
        await del(url);
      }
    } catch (error) {
      console.error('Error deleting blob:', error);
    }
  }

  async updateUserAvatar(userId: string, file: MulterFile) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete old avatar if exists
    if (user.avatar) {
      await this.deleteFromBlob(user.avatar);
    }

    // Upload new avatar to Vercel Blob
    const avatarUrl = await this.uploadToBlob(file, 'avatars');

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
      },
    });

    return updatedUser;
  }

  async deleteUserAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.avatar) {
      await this.deleteFromBlob(user.avatar);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
      },
    });

    return updatedUser;
  }

  async uploadPropertyImages(files: MulterFile[]): Promise<string[]> {
    const urls = await Promise.all(
      files.map((file) => this.uploadToBlob(file, 'properties')),
    );
    return urls;
  }

  async deletePropertyImage(url: string): Promise<void> {
    await this.deleteFromBlob(url);
  }

  async uploadGalleryFiles(files: MulterFile[]): Promise<string[]> {
    const urls = await Promise.all(
      files.map((file) => this.uploadToBlob(file, 'gallery')),
    );
    return urls;
  }

  async uploadCmsFiles(files: MulterFile[]): Promise<string[]> {
    const urls = await Promise.all(
      files.map((file) => this.uploadToBlob(file, 'cms')),
    );
    return urls;
  }

  async uploadTaskFiles(files: MulterFile[]): Promise<string[]> {
    const urls = await Promise.all(
      files.map((file) => this.uploadToBlob(file, 'tasks')),
    );
    return urls;
  }

  async uploadCompanyLogo(file: MulterFile): Promise<{ url: string }> {
    const url = await this.uploadToBlob(file, 'company-logos');
    return { url };
  }
}
