import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { OpenAiService } from './openai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PropertyType } from '@prisma/client';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly openAiService: OpenAiService,
  ) {}

  @Post('predict-price')
  @ApiOperation({ summary: 'Predict property price using AI' })
  @ApiResponse({ status: 200, description: 'Price prediction' })
  async predictPrice(
    @Body() data: {
      type: PropertyType;
      city: string;
      area: number;
      bedrooms?: number;
      bathrooms?: number;
      yearBuilt?: number;
      features?: string[];
    },
  ) {
    return this.aiService.predictPropertyPrice(data);
  }

  @Get('market-analysis')
  @ApiOperation({ summary: 'Get AI market analysis for a city' })
  @ApiQuery({ name: 'city', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Market analysis' })
  async getMarketAnalysis(@Query('city') city: string) {
    return this.aiService.getMarketAnalysis(city);
  }

  @Get('realtor-performance/:realtorId')
  @ApiOperation({ summary: 'Predict realtor performance' })
  @ApiResponse({ status: 200, description: 'Performance prediction' })
  async predictRealtorPerformance(@Param('realtorId') realtorId: string) {
    return this.aiService.predictRealtorPerformance(realtorId);
  }

  @Get('investment-score/:propertyId')
  @ApiOperation({ summary: 'Get property investment score' })
  @ApiResponse({ status: 200, description: 'Investment score' })
  async getInvestmentScore(@Param('propertyId') propertyId: string) {
    return this.aiService.getInvestmentScore(propertyId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // OpenAI-powered features (gracefully degrade when OPENAI_API_KEY not set)
  // ──────────────────────────────────────────────────────────────────────────

  @Post('generate-description')
  @ApiOperation({ summary: 'Generate a compelling property description using AI' })
  @ApiResponse({ status: 200, description: 'AI-generated property description' })
  async generatePropertyDescription(
    @Body() data: {
      title: string;
      type: string;
      city: string;
      area: number;
      bedrooms?: number;
      bathrooms?: number;
      features?: string[];
      price?: number;
    },
  ) {
    const description = await this.openAiService.generatePropertyDescription(data);
    return {
      description,
      aiPowered: this.openAiService.isAvailable(),
    };
  }

  @Post('market-price-insights')
  @ApiOperation({ summary: 'Get AI-powered market price insights for a property type and city' })
  @ApiResponse({ status: 200, description: 'Market price insights with recommendation' })
  async getMarketPriceInsights(
    @Body() body: { city: string; propertyType: string },
  ) {
    const [result, comparables] = await Promise.all([
      this.aiService.getMarketAnalysis(body.city),
      this.aiService.getComparables(body.city, body.propertyType),
    ]);
    const insights = await this.openAiService.getMarketPriceInsights(
      body.city,
      body.propertyType,
      comparables,
    );
    return { ...result, aiInsights: insights, aiPowered: this.openAiService.isAvailable() };
  }

  @Post('score-leads')
  @ApiOperation({ summary: 'AI lead scoring — rank client leads by purchase likelihood' })
  @ApiResponse({ status: 200, description: 'Scored leads array' })
  async scoreLeads(
    @Body() body: { leads: Array<{ id: string; enquiries?: number; viewings?: number; budget?: number; timeframe?: string }> },
  ) {
    const scored = await this.openAiService.scoreLeads(body.leads);
    return { scored, aiPowered: this.openAiService.isAvailable() };
  }

  @Get('sales-trend-prediction')
  @ApiOperation({ summary: 'Predict next month sales trends using AI' })
  @ApiQuery({ name: 'months', required: false, description: 'Number of historical months to analyse (default 6)' })
  async predictSalesTrends(@Query('months') months?: string) {
    const lookback = Math.min(parseInt(months ?? '6', 10), 24);
    const data = await this.aiService.buildMonthlySalesData(lookback);
    const prediction = await this.openAiService.predictSalesTrends(data);
    return { historical: data, prediction, aiPowered: this.openAiService.isAvailable() };
  }
}
