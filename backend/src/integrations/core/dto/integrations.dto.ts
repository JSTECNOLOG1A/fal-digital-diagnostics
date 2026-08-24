import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum IntegrationDirectionDto {
  outbound = 'outbound',
  inbound = 'inbound',
  bidirectional = 'bidirectional',
}

export class UpsertIntegrationConnectionDto {
  @ApiProperty({ example: 'custom-erp' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  provider!: string;

  @ApiProperty({ example: 'ERP Principal' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ enum: IntegrationDirectionDto })
  @IsOptional()
  @IsEnum(IntegrationDirectionDto)
  direction?: IntegrationDirectionDto;

  @ApiPropertyOptional({ example: 'https://erp.empresa.com/api' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @ApiPropertyOptional({ example: 'api_key', description: 'api_key | basic | oauth2 | none' })
  @IsOptional()
  @IsString()
  authType?: string;

  @ApiPropertyOptional({
    description: 'Segredos em texto (serão criptografados). Ex: { apiKey, clientSecret }',
  })
  @IsOptional()
  @IsObject()
  secrets?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Configuração não-sensível' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Integração BI' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['partner:ping', 'groups:read', 'companies:read', 'webhooks:receive'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class CreateWebhookEndpointDto {
  @ApiProperty({ example: 'Notificar CRM' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'https://crm.empresa.com/hooks/fal' })
  @IsUrl({ require_tld: false })
  targetUrl!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['group.created', 'company.created', 'company.updated'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({ description: 'Segredo HMAC (opcional). Se omitido, geramos um.' })
  @IsOptional()
  @IsString()
  @MinLength(16)
  signingSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class DispatchWebhookDto {
  @ApiProperty({ example: 'company.created' })
  @IsString()
  event!: string;

  @ApiProperty({ description: 'Payload JSON do evento' })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class InboundWebhookDto {
  @ApiPropertyOptional({ example: 'company.upserted' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
