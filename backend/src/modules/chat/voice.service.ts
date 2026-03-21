import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';

interface VoiceUploadResult {
  audioUrl: string;
  duration: number;      // seconds (from client)
  waveform: number[];    // 40 amplitude values 0.0–1.0
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  // Max 10 MB voice note
  private readonly MAX_BYTES = 10 * 1024 * 1024;
  private readonly ALLOWED_MIME = new Set([
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-m4a',
  ]);

  async uploadVoiceNote(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    durationSeconds: number,
  ): Promise<VoiceUploadResult> {
    // Validate size
    if (buffer.byteLength > this.MAX_BYTES) {
      throw new BadRequestException('Voice note exceeds 10 MB limit');
    }

    // Validate mime — normalise by stripping codec suffix for check
    const baseMime = mimeType.split(';')[0].trim().toLowerCase();
    if (!this.ALLOWED_MIME.has(baseMime) && !this.ALLOWED_MIME.has(mimeType.toLowerCase())) {
      throw new BadRequestException(`Unsupported audio format: ${mimeType}`);
    }

    // Determine extension
    const ext = this.mimeToExt(baseMime);
    const filename = `voice-notes/${uuidv4()}${ext}`;

    // Upload to Vercel Blob
    let audioUrl: string;
    try {
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType: mimeType,
        addRandomSuffix: false,
      });
      audioUrl = blob.url;
    } catch (err) {
      this.logger.error(`Voice upload failed: ${err.message}`);
      throw new BadRequestException('Failed to upload voice note. Please try again.');
    }

    // Generate waveform
    const waveform = this.generateWaveform(buffer, 40);

    return {
      audioUrl,
      duration: Math.max(1, Math.round(durationSeconds)),
      waveform,
    };
  }

  /**
   * Generates a plausible-looking voice waveform by sampling raw bytes.
   * Real amplitude decoding would require Web Audio API (unavailable in NestJS).
   * We normalise byte values to produce a realistic speech-like envelope.
   */
  private generateWaveform(buffer: Buffer, bars: number): number[] {
    if (buffer.length < bars) {
      // Too small — return a flat-ish waveform
      return Array.from({ length: bars }, () => Math.random() * 0.4 + 0.1);
    }

    // Sample evenly across the buffer (skip binary headers by starting at 5%)
    const start = Math.floor(buffer.length * 0.05);
    const end = Math.floor(buffer.length * 0.95);
    const range = end - start;
    const step = Math.floor(range / bars);

    const raw: number[] = [];
    for (let i = 0; i < bars; i++) {
      const offset = start + i * step;
      // Average a small window of bytes to smooth noise
      let sum = 0;
      const window = Math.min(step, 8);
      for (let j = 0; j < window; j++) {
        sum += buffer[offset + j] ?? 0;
      }
      raw.push(sum / window);
    }

    // Normalise to 0.05–1.0 range to look like voice activity
    const max = Math.max(...raw, 1);
    const min = Math.min(...raw, 0);
    const span = max - min || 1;

    return raw.map((v) => {
      const norm = (v - min) / span;           // 0–1
      return Math.round((norm * 0.85 + 0.1) * 100) / 100; // clamp to 0.10–0.95
    });
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'audio/webm': '.webm',
      'audio/ogg': '.ogg',
      'audio/mp4': '.m4a',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/x-m4a': '.m4a',
    };
    return map[mime] ?? '.audio';
  }
}
