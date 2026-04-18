import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Swagger is dynamically imported below only in non-production environments
import { NestExpressApplication } from '@nestjs/platform-express';
import { ExpressAdapter } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import express from 'express';

import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditService } from './common/services/audit.service';

/** Shared bootstrap configuration — used by both local dev server and Vercel serverless */
export async function configureApp(expressInstance?: express.Express) {
  const adapter = expressInstance
    ? new ExpressAdapter(expressInstance)
    : undefined;

  const app = adapter
    ? await NestFactory.create<NestExpressApplication>(AppModule, adapter, {
        logger: ['error', 'warn', 'log'],
      })
    : await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      });

  const configService = app.get(ConfigService);

  // Security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  // Vercel CDN only compresses static assets — serverless JSON responses are NOT
  // compressed automatically. Enable compression unconditionally.
  app.use(compression());

  // CORS
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    configService.get<string>('FRONTEND_URL'),
    configService.get<string>('CORS_ORIGIN'),
  ].filter(Boolean);

  app.enableCors({
    origin: true, // reflect request Origin — required for dynamic tenant custom domains
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret', 'x-company-id'],
    credentials: true,
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  const auditService = app.get(AuditService);
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new LoggingInterceptor() as any,
    new TransformInterceptor() as any,
    new AuditInterceptor(auditService, reflector) as any,
  );

  return { app, configService };
}

async function bootstrap() {
  const { app, configService } = await configureApp();

  const port = configService.get<number>('PORT', 4000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Swagger documentation (dynamically imported to avoid parsing in production)
  if (nodeEnv !== 'production') {
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('Livora OS API')
      .setDescription('Livora OS - Enterprise PropTech Platform API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Auth', 'Authentication endpoints')
      .addTag('Users', 'User management endpoints')
      .addTag('Admin', 'Admin dashboard endpoints')
      .addTag('Realtors', 'Realtor management endpoints')
      .addTag('Clients', 'Client management endpoints')
      .addTag('Properties', 'Property management endpoints')
      .addTag('Sales', 'Sales management endpoints')
      .addTag('Commission', 'Commission management endpoints')
      .addTag('Tax', 'Tax management endpoints')
      .addTag('Loyalty', 'Loyalty system endpoints')
      .addTag('Rankings', 'Ranking system endpoints')
      .addTag('Chat', 'Chat system endpoints')
      .addTag('Notifications', 'Notification endpoints')
      .addTag('Analytics', 'Analytics endpoints')
      .addTag('Upload', 'File upload endpoints')
      .build();

    const document = SwaggerModule.createDocument(app as any, config);
    SwaggerModule.setup('api/docs', app as any, document);
  }

  await app.listen(port);

  console.log(`
  Livora OS
  Environment: ${nodeEnv}
  Server running on: http://localhost:${port}
  API Documentation: http://localhost:${port}/api/docs
  `);
}

// Only run the standalone server when not in Vercel serverless environment
if (!process.env.VERCEL) {
  bootstrap();
}
