import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  const prefix = config.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(prefix);

  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Tenant-Id',
      'X-Api-Key',
    ],
  });

  // CSP padrão do Helmet quebra o Swagger UI (tela branca).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'connect-src': ["'self'"],
          'font-src': ["'self'", 'data:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swagger = new DocumentBuilder()
    .setTitle('FAL API')
    .setDescription(
      'Método FAL — backend próprio (PostgreSQL + JWT + RBAC + RLS). Baseline alinhado a ISO/IEC 27001 e LGPD.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger), {
    customSiteTitle: 'FAL API',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Evita "tela vazia" em /
  const http = app.getHttpAdapter().getInstance();
  http.get('/', (_req: unknown, res: { redirect: (code: number, url: string) => void }) => {
    res.redirect(302, '/docs');
  });

  const port = Number(config.get('API_PORT') ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`FAL API listening on http://localhost:${port}/${prefix}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger UI: http://localhost:${port}/docs`);
}

bootstrap();
