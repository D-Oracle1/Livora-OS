/**
 * OpenAI integration service.
 *
 * Loads the openai SDK dynamically — the app starts normally even if the package
 * is not installed.  Install with:  npm install openai --save
 * then set OPENAI_API_KEY in your .env.
 *
 * All responses are cached in Redis (via CacheService) for 24 hours to reduce API cost.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class OpenAiService implements OnModuleInit {
  private readonly logger = new Logger(OpenAiService.name);
  private client: any = null;
  private readonly model: string;
  private readonly CACHE_TTL = 86400; // 24 hours

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.model = config.get('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async onModuleInit() {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.log('OPENAI_API_KEY not configured — OpenAI features will use rule-based fallbacks');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const OpenAI = require('openai') as any;
      const OpenAIClass = OpenAI.default ?? OpenAI;
      this.client = new OpenAIClass({ apiKey });
      this.logger.log(`OpenAI client initialized (model: ${this.model})`);
    } catch (err: any) {
      this.logger.warn(`openai package not installed (${err.message}). Install with: npm install openai`);
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generatePropertyDescription(data: {
    title: string;
    type: string;
    city: string;
    area: number;
    bedrooms?: number;
    bathrooms?: number;
    features?: string[];
    price?: number;
  }): Promise<string> {
    const cacheKey = `ai:prop-desc:${JSON.stringify(data)}`;
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) return cached;

    if (!this.isAvailable()) {
      return this.fallbackPropertyDescription(data);
    }

    const prompt = `Write a compelling, professional real estate listing description for the following property. Use engaging language that highlights key selling points. Keep it to 3-4 sentences, around 100-150 words.

Property Details:
- Title: ${data.title}
- Type: ${data.type}
- Location: ${data.city}
- Area: ${data.area} sqft
${data.bedrooms ? `- Bedrooms: ${data.bedrooms}` : ''}
${data.bathrooms ? `- Bathrooms: ${data.bathrooms}` : ''}
${data.features?.length ? `- Features: ${data.features.join(', ')}` : ''}
${data.price ? `- Price: $${data.price.toLocaleString()}` : ''}

Write ONLY the description text, no additional commentary.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.7,
      });

      const description = response.choices[0]?.message?.content?.trim() ?? this.fallbackPropertyDescription(data);
      await this.cache.set(cacheKey, description, this.CACHE_TTL);
      return description;
    } catch (err: any) {
      this.logger.error(`OpenAI property description failed: ${err.message}`);
      return this.fallbackPropertyDescription(data);
    }
  }

  async getMarketPriceInsights(city: string, propertyType: string, comparables: any[]): Promise<{
    summary: string;
    priceRange: { low: number; high: number };
    recommendation: string;
    confidence: string;
  }> {
    const cacheKey = `ai:market:${city}:${propertyType}:${comparables.length}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    if (!this.isAvailable() || comparables.length === 0) {
      return this.fallbackMarketInsights(comparables);
    }

    const avgPrice = comparables.reduce((s, c) => s + Number(c.price), 0) / comparables.length;
    const prices = comparables.map((c) => Number(c.price)).sort((a, b) => a - b);

    const prompt = `You are a real estate market analyst. Analyze this property market data and provide insights in JSON format.

City: ${city}
Property Type: ${propertyType}
Number of comparable properties: ${comparables.length}
Average price: $${Math.round(avgPrice).toLocaleString()}
Price range: $${Math.round(prices[0]).toLocaleString()} - $${Math.round(prices[prices.length - 1]).toLocaleString()}
Sample prices: ${prices.slice(0, 5).map((p) => '$' + Math.round(p).toLocaleString()).join(', ')}

Respond with ONLY valid JSON (no markdown) in this exact format:
{
  "summary": "2-3 sentence market summary",
  "priceRange": { "low": number, "high": number },
  "recommendation": "1 sentence actionable recommendation",
  "confidence": "high|medium|low"
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
      const result = JSON.parse(raw);
      await this.cache.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (err: any) {
      this.logger.error(`OpenAI market insights failed: ${err.message}`);
      return this.fallbackMarketInsights(comparables);
    }
  }

  async scoreLeads(leads: Array<{ id: string; enquiries?: number; viewings?: number; budget?: number; timeframe?: string }>): Promise<Array<{
    id: string;
    score: number;
    tier: 'hot' | 'warm' | 'cold';
    reasoning: string;
  }>> {
    if (!this.isAvailable()) {
      return leads.map((l) => this.fallbackLeadScore(l));
    }

    const cacheKey = `ai:leads:${JSON.stringify(leads)}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const prompt = `Score these real estate leads and classify them. For each lead, assign a score (0-100) and tier.

Leads data:
${JSON.stringify(leads, null, 2)}

Respond with ONLY valid JSON (no markdown) in this exact format:
[
  {
    "id": "lead_id",
    "score": 85,
    "tier": "hot",
    "reasoning": "brief one-line reason"
  }
]`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? '[]';
      const parsed = JSON.parse(raw);
      const result = Array.isArray(parsed) ? parsed : (parsed.leads ?? leads.map((l) => this.fallbackLeadScore(l)));
      await this.cache.set(cacheKey, result, 3600);
      return result;
    } catch (err: any) {
      this.logger.error(`OpenAI lead scoring failed: ${err.message}`);
      return leads.map((l) => this.fallbackLeadScore(l));
    }
  }

  async predictSalesTrends(monthlySalesData: Array<{ month: string; count: number; value: number }>): Promise<{
    trend: 'rising' | 'falling' | 'stable';
    nextMonthPrediction: { count: number; value: number };
    insights: string[];
    confidence: string;
  }> {
    const cacheKey = `ai:trend:${JSON.stringify(monthlySalesData)}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    if (!this.isAvailable() || monthlySalesData.length < 2) {
      return this.fallbackSalesTrend(monthlySalesData);
    }

    const prompt = `Analyze these monthly real estate sales trends and predict the next month.

Historical data (most recent first):
${JSON.stringify(monthlySalesData, null, 2)}

Respond with ONLY valid JSON (no markdown):
{
  "trend": "rising|falling|stable",
  "nextMonthPrediction": { "count": number, "value": number },
  "insights": ["insight 1", "insight 2", "insight 3"],
  "confidence": "high|medium|low"
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
      const result = JSON.parse(raw);
      await this.cache.set(cacheKey, result, 3600);
      return result;
    } catch (err: any) {
      this.logger.error(`OpenAI sales trend prediction failed: ${err.message}`);
      return this.fallbackSalesTrend(monthlySalesData);
    }
  }

  // ─────────────────────────────────────────────
  // Rule-based fallbacks (no API key required)
  // ─────────────────────────────────────────────

  private fallbackPropertyDescription(data: any): string {
    const features = data.features?.length ? ` featuring ${data.features.slice(0, 3).join(', ')}` : '';
    return `This stunning ${data.type.toLowerCase().replace('_', ' ')} in ${data.city} offers ${data.area} sqft of living space${data.bedrooms ? ` with ${data.bedrooms} bedrooms and ${data.bathrooms} bathrooms` : ''}${features}. Located in a prime ${data.city} neighborhood, this property combines comfort and modern living. Contact us today to schedule a viewing.`;
  }

  private fallbackMarketInsights(comparables: any[]): any {
    if (comparables.length === 0) {
      return { summary: 'Insufficient data for market analysis.', priceRange: { low: 0, high: 0 }, recommendation: 'Gather more comparable sales data.', confidence: 'low' };
    }
    const prices = comparables.map((c) => Number(c.price)).sort((a, b) => a - b);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    return {
      summary: `Based on ${comparables.length} comparable properties, the market shows an average price of $${Math.round(avg).toLocaleString()}.`,
      priceRange: { low: Math.round(prices[0]), high: Math.round(prices[prices.length - 1]) },
      recommendation: 'Price competitively within the observed range for optimal market positioning.',
      confidence: comparables.length >= 10 ? 'medium' : 'low',
    };
  }

  private fallbackLeadScore(lead: any): any {
    let score = 40;
    if (lead.enquiries > 3) score += 20;
    if (lead.viewings > 0) score += 25;
    if (lead.budget > 100000) score += 15;
    const tier = score >= 75 ? 'hot' : score >= 50 ? 'warm' : 'cold';
    return { id: lead.id, score: Math.min(score, 100), tier, reasoning: 'Scored based on engagement metrics.' };
  }

  private fallbackSalesTrend(data: any[]): any {
    if (data.length < 2) return { trend: 'stable', nextMonthPrediction: { count: 0, value: 0 }, insights: ['Insufficient data'], confidence: 'low' };
    const recent = data[0];
    const older = data[data.length - 1];
    const trend = recent.count > older.count ? 'rising' : recent.count < older.count ? 'falling' : 'stable';
    return {
      trend,
      nextMonthPrediction: { count: Math.round(recent.count * 1.05), value: Math.round(recent.value * 1.05) },
      insights: [`Sales are ${trend} based on historical data`, `Latest month: ${recent.count} sales`],
      confidence: 'low',
    };
  }
}
