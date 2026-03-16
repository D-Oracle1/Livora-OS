/**
 * CDN & Image Optimization Service.
 *
 * Two responsibilities:
 *   1. URL rewriting — if CDN_BASE_URL is configured, blob/S3 URLs are rewritten
 *      to point at the CDN origin (e.g. a CloudFront distribution sitting in front
 *      of Vercel Blob).  The pathname is preserved; only the host/protocol changes.
 *
 *   2. Image optimization — when `sharp` is installed, uploaded image buffers are
 *      resized to caller-specified max dimensions and converted to WebP before
 *      being stored, reducing file size by 40-70 % on average.
 *      Graceful degradation: if sharp is not installed the original buffer is used.
 *
 * Install sharp (optional):  npm install sharp
 * Set env:  CDN_BASE_URL=https://d1234abcd.cloudfront.net
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ImageOptimizeOpts {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface OptimizedImage {
  buffer: Buffer;
  mimetype: string;
  /** '.webp' | original extension string */
  ext: string;
}

@Injectable()
export class CdnService implements OnModuleInit {
  private readonly logger = new Logger(CdnService.name);
  private sharp: any = null;
  private readonly cdnBaseUrl: string | null;

  constructor(private readonly config: ConfigService) {
    this.cdnBaseUrl = config.get<string>('CDN_BASE_URL') ?? null;
  }

  async onModuleInit() {
    if (this.cdnBaseUrl) {
      this.logger.log(`CDN URL rewriting enabled → ${this.cdnBaseUrl}`);
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.sharp = require('sharp');
      this.logger.log('sharp image optimization enabled');
    } catch {
      this.logger.log(
        'sharp not installed — images stored without server-side optimization. ' +
          'Install with: npm install sharp',
      );
    }
  }

  /**
   * Rewrite a Vercel Blob / S3 URL to the configured CDN origin.
   * Returns the original URL unchanged when CDN_BASE_URL is not set.
   */
  rewriteUrl(storageUrl: string): string {
    if (!this.cdnBaseUrl || !storageUrl) return storageUrl;
    try {
      const parsed = new URL(storageUrl);
      const cdn = new URL(this.cdnBaseUrl);
      parsed.protocol = cdn.protocol;
      parsed.host = cdn.host;
      return parsed.toString();
    } catch {
      return storageUrl;
    }
  }

  /**
   * Resize and convert an image buffer to WebP.
   * Returns the original buffer + mimetype when sharp is unavailable or on error.
   */
  async optimizeImage(
    buffer: Buffer,
    mimetype: string,
    originalExt: string,
    opts: ImageOptimizeOpts = {},
  ): Promise<OptimizedImage> {
    if (!this.sharp || !mimetype.startsWith('image/')) {
      return { buffer, mimetype, ext: originalExt };
    }

    try {
      const { maxWidth = 1920, maxHeight = 1080, quality = 80 } = opts;
      const optimized: Buffer = await this.sharp(buffer)
        .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      return { buffer: optimized, mimetype: 'image/webp', ext: '.webp' };
    } catch (err: any) {
      this.logger.warn(`Image optimization skipped: ${err.message}`);
      return { buffer, mimetype, ext: originalExt };
    }
  }

  isSharpAvailable(): boolean {
    return this.sharp !== null;
  }

  isCdnConfigured(): boolean {
    return this.cdnBaseUrl !== null;
  }
}
