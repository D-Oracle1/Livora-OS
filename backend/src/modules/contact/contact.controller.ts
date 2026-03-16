import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  /**
   * POST /api/v1/contact
   * Public endpoint — rate limited to 3 requests per minute per IP.
   */
  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Submit a contact form enquiry' })
  @ApiResponse({ status: 200, description: 'Message submitted successfully' })
  @ApiResponse({ status: 429, description: 'Too many requests — rate limit exceeded' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async submit(@Body() dto: CreateContactDto, @Ip() ip: string) {
    return this.contactService.submitContactForm(dto, ip);
  }
}
