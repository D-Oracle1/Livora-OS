import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as QRCode from 'qrcode';

export interface QrPayload {
  type: 'event-registration' | 'event-page';
  eventId: string;
  registrationId?: string;
  registrationCode?: string;
}

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Signs a payload and returns a compact JWT token used inside the QR code.
   * Tokens never expire (the registration record controls validity).
   */
  signToken(payload: QrPayload): string {
    return this.jwtService.sign(payload, { expiresIn: '3650d' }); // 10-year shelf life
  }

  /**
   * Verifies and decodes a QR token. Throws BadRequestException on any failure.
   */
  verifyToken(token: string): QrPayload {
    try {
      const decoded = this.jwtService.verify<QrPayload>(token);
      if (
        decoded.type !== 'event-registration' &&
        decoded.type !== 'event-page'
      ) {
        throw new BadRequestException('Invalid QR code type');
      }
      return decoded;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid or tampered QR code');
    }
  }

  /**
   * Generates a QR data URL (base64 PNG) encoding the given token string.
   */
  async generateDataUrl(token: string): Promise<string> {
    return QRCode.toDataURL(token, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'H',
    });
  }

  /**
   * Full pipeline: sign + render → { token, dataUrl }
   */
  async createQr(payload: QrPayload): Promise<{ token: string; dataUrl: string }> {
    const token = this.signToken(payload);
    const dataUrl = await this.generateDataUrl(token);
    return { token, dataUrl };
  }
}
