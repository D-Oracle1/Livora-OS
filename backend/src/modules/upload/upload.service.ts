import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MasterPrismaService } from '../../database/master-prisma.service';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterPrisma: MasterPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

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

  /**
   * Resolve a user from either the correct tenant DB (via companyId) or the master super_admins table.
   * `companyId` comes from the JWT payload and bypasses the request-scoped PrismaService so that
   * the lookup works even when the backend receives requests on its own domain (no tenant context).
   */
  private async resolveUser(
    userId: string,
    companyId?: string | null,
  ): Promise<{ user: any; isSuperAdmin: boolean; resolvedCompanyId?: string }> {
    // 1. Direct tenant DB lookup when companyId is available (most reliable path)
    if (companyId) {
      try {
        const client = await this.tenantPrisma.getClient(companyId);
        const tenantUser = await client.user.findUnique({ where: { id: userId } });
        if (tenantUser) return { user: tenantUser, isSuperAdmin: false, resolvedCompanyId: companyId };
      } catch { /* fall through */ }
    }

    // 2. Fallback via request-scoped PrismaService (works when tenant context is set correctly)
    const tenantUser = await this.prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
    if (tenantUser) return { user: tenantUser, isSuperAdmin: false };

    // 3. Master super_admins table
    const superAdmin = await this.masterPrisma.superAdmin.findUnique({ where: { id: userId } });
    if (superAdmin) return { user: superAdmin, isSuperAdmin: true };

    throw new NotFoundException('User not found');
  }

  async updateUserAvatar(userId: string, file: MulterFile, companyId?: string | null) {
    const resolved = await this.resolveUser(userId, companyId);
    const { user, isSuperAdmin } = resolved;

    if (user.avatar) {
      await this.deleteFromBlob(user.avatar);
    }

    const avatarUrl = await this.uploadToBlob(file, 'avatars');

    if (isSuperAdmin) {
      await this.masterPrisma.superAdmin.update({
        where: { id: userId },
        data: { avatar: avatarUrl },
      });
    } else if (resolved.resolvedCompanyId) {
      const client = await this.tenantPrisma.getClient(resolved.resolvedCompanyId);
      await client.user.update({ where: { id: userId }, data: { avatar: avatarUrl } });
    } else {
      await this.prisma.user.update({ where: { id: userId }, data: { avatar: avatarUrl } });
    }

    return { url: avatarUrl };
  }

  async deleteUserAvatar(userId: string, companyId?: string | null) {
    const resolved = await this.resolveUser(userId, companyId);
    const { user, isSuperAdmin } = resolved;

    if (user.avatar) {
      await this.deleteFromBlob(user.avatar);
    }

    if (isSuperAdmin) {
      return this.masterPrisma.superAdmin.update({
        where: { id: userId },
        data: { avatar: null },
        select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
      });
    }

    if (resolved.resolvedCompanyId) {
      const client = await this.tenantPrisma.getClient(resolved.resolvedCompanyId);
      return client.user.update({
        where: { id: userId },
        data: { avatar: null },
        select: { id: true, email: true, firstName: true, lastName: true, avatar: true, role: true },
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: { id: true, email: true, firstName: true, lastName: true, avatar: true, role: true },
    });
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
