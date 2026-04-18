import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CampaignTone } from './enums';

export interface AIGeneratedContent {
  subject: string;
  htmlContent: string;
  promptUsed: string;
}

interface GenerateOptions {
  tone: CampaignTone;
  companyName?: string;
  brandColor?: string;
  ctaUrl?: string;
  ctaText?: string;
}

interface NewsletterData extends GenerateOptions {
  topics?: string[];
  properties?: Array<{ title: string; price: string; location: string; url?: string }>;
  marketInsights?: string;
}

interface BirthdayData extends GenerateOptions {
  recipientName: string;
  recipientRole?: string;
}

interface PropertyAlertData extends GenerateOptions {
  properties: Array<{
    title: string;
    price: string;
    location: string;
    type: string;
    bedrooms?: number;
    bathrooms?: number;
    area?: string;
    imageUrl?: string;
    url?: string;
  }>;
  recipientName?: string;
}

interface CustomCampaignData extends GenerateOptions {
  prompt: string;
  context?: string;
}

@Injectable()
export class AiMessagingService {
  private readonly logger = new Logger(AiMessagingService.name);
  private readonly apiKey: string;
  private readonly provider: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('openai.apiKey', '');
    this.provider = this.configService.get<string>('ai.provider', 'openai');
    this.model = this.configService.get<string>('ai.model', 'gpt-4o-mini');
  }

  async generateNewsletterContent(data: NewsletterData): Promise<AIGeneratedContent> {
    const toneGuide = this.getToneGuide(data.tone);
    const companyName = data.companyName || 'Livora OS';
    const brandColor = data.brandColor || '#1F5625';

    const prompt = `You are an expert real estate email copywriter for ${companyName}.
Write a compelling HTML newsletter email.

TONE: ${toneGuide}
BRAND COLOR: ${brandColor}

${data.topics?.length ? `TOPICS TO COVER:\n${data.topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}` : ''}

${data.properties?.length ? `FEATURED PROPERTIES:\n${data.properties.map(p => `- ${p.title} at ${p.location} for ${p.price}`).join('\n')}` : ''}

${data.marketInsights ? `MARKET INSIGHTS: ${data.marketInsights}` : ''}

REQUIREMENTS:
- Generate a catchy subject line on the first line prefixed with "SUBJECT: "
- Write valid HTML email content (inline CSS only, max-width 600px)
- Use brand color ${brandColor} for headings and CTA buttons
- Include a clear call-to-action button
- Keep it concise but engaging
- Real estate focused language
- Mobile-friendly design
${data.ctaUrl ? `- CTA link: ${data.ctaUrl}` : ''}
${data.ctaText ? `- CTA text: ${data.ctaText}` : ''}`;

    return this.callLLM(prompt);
  }

  async generateBirthdayMessage(data: BirthdayData): Promise<AIGeneratedContent> {
    const toneGuide = this.getToneGuide(data.tone);
    const companyName = data.companyName || 'Livora OS';
    const brandColor = data.brandColor || '#1F5625';

    const prompt = `You are writing a birthday email for ${companyName}, a real estate company.

RECIPIENT: ${data.recipientName}
ROLE: ${data.recipientRole || 'valued client'}
TONE: ${toneGuide}
BRAND COLOR: ${brandColor}

REQUIREMENTS:
- Generate a warm subject line on the first line prefixed with "SUBJECT: "
- Write valid HTML email (inline CSS, max-width 600px)
- Warm, personal birthday greeting
- Mention their role with the company naturally
- Include a subtle real estate tie-in or offer
- Use brand color ${brandColor} for accents
- Keep it short and heartfelt (3-4 paragraphs max)
${data.ctaUrl ? `- Include CTA to: ${data.ctaUrl}` : ''}`;

    return this.callLLM(prompt);
  }

  async generatePropertyAlert(data: PropertyAlertData): Promise<AIGeneratedContent> {
    const toneGuide = this.getToneGuide(data.tone);
    const companyName = data.companyName || 'Livora OS';
    const brandColor = data.brandColor || '#1F5625';

    const propertyList = data.properties
      .map(p => `- ${p.title} | ${p.type} | ${p.location} | ${p.price}${p.bedrooms ? ` | ${p.bedrooms}bd/${p.bathrooms}ba` : ''}${p.area ? ` | ${p.area}` : ''}`)
      .join('\n');

    const prompt = `You are writing a property alert email for ${companyName}.

${data.recipientName ? `RECIPIENT: ${data.recipientName}` : ''}
TONE: ${toneGuide}
BRAND COLOR: ${brandColor}

PROPERTIES:
${propertyList}

REQUIREMENTS:
- Generate an attention-grabbing subject line prefixed with "SUBJECT: "
- Write valid HTML email (inline CSS, max-width 600px)
- Showcase each property with a card-like layout
- Use brand color ${brandColor} for headings and buttons
- Include a "View Property" CTA for each property
- Highlight key features and pricing
- Mobile responsive design
${data.ctaUrl ? `- Main CTA: ${data.ctaUrl}` : ''}`;

    return this.callLLM(prompt);
  }

  async generateCustomCampaign(data: CustomCampaignData): Promise<AIGeneratedContent> {
    const toneGuide = this.getToneGuide(data.tone);
    const companyName = data.companyName || 'Livora OS';
    const brandColor = data.brandColor || '#1F5625';

    const prompt = `You are writing a marketing email for ${companyName}, a real estate company.

CUSTOM BRIEF: ${data.prompt}

${data.context ? `ADDITIONAL CONTEXT: ${data.context}` : ''}

TONE: ${toneGuide}
BRAND COLOR: ${brandColor}

REQUIREMENTS:
- Generate a subject line on the first line prefixed with "SUBJECT: "
- Write valid HTML email (inline CSS, max-width 600px)
- Use brand color ${brandColor} for key elements
- Include a clear call-to-action
- Professional real estate industry language
- Mobile-friendly design
${data.ctaUrl ? `- CTA link: ${data.ctaUrl}` : ''}
${data.ctaText ? `- CTA text: ${data.ctaText}` : ''}`;

    return this.callLLM(prompt);
  }

  private async callLLM(prompt: string): Promise<AIGeneratedContent> {
    if (!this.apiKey) {
      this.logger.warn('No AI API key configured — returning fallback content');
      return this.fallbackContent(prompt);
    }

    try {
      const response = await this.makeProviderRequest(prompt);
      return this.parseResponse(response, prompt);
    } catch (error) {
      this.logger.error(`LLM call failed: ${error.message}`);
      return this.fallbackContent(prompt);
    }
  }

  private async makeProviderRequest(prompt: string): Promise<string> {
    if (this.provider === 'anthropic') {
      return this.callAnthropic(prompt);
    }
    return this.callOpenAI(prompt);
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a professional real estate email marketing copywriter. Always output valid HTML.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model || 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
        system: 'You are a professional real estate email marketing copywriter. Always output valid HTML.',
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    return json.content?.[0]?.text || '';
  }

  private parseResponse(rawContent: string, prompt: string): AIGeneratedContent {
    let subject = 'Update from Livora OS';
    let htmlContent = rawContent;

    // Extract subject line
    const subjectMatch = rawContent.match(/^SUBJECT:\s*(.+?)$/m);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      htmlContent = rawContent.replace(/^SUBJECT:\s*.+?\n/m, '').trim();
    }

    // Clean up markdown code fences if present
    htmlContent = htmlContent.replace(/^```html?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();

    return { subject, htmlContent, promptUsed: prompt };
  }

  private fallbackContent(prompt: string): AIGeneratedContent {
    return {
      subject: 'Update from Livora OS',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1F5625;">Latest Updates</h2>
          <p>We have exciting news and updates to share with you.</p>
          <p>Visit our platform to see the latest properties and opportunities.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background-color: #1F5625; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Dashboard
            </a>
          </div>
        </div>
      `,
      promptUsed: prompt,
    };
  }

  private getToneGuide(tone: CampaignTone): string {
    const guides: Record<CampaignTone, string> = {
      PROFESSIONAL: 'Professional and authoritative. Use formal language, industry terminology, and data-driven messaging.',
      FRIENDLY: 'Warm and approachable. Use conversational language, personal touches, and an inviting tone.',
      LUXURY: 'Elegant and exclusive. Use sophisticated vocabulary, emphasize prestige, and create a sense of exclusivity.',
      CORPORATE: 'Corporate and structured. Use clear, concise language with a focus on ROI, metrics, and business value.',
    };
    return guides[tone] || guides.PROFESSIONAL;
  }
}
