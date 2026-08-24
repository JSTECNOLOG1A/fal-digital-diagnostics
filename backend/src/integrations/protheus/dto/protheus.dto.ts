import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertProtheusConnectionDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  username!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @ApiProperty({ example: '01' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  companyCode!: string;

  @ApiPropertyOptional({ example: '01' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  branchCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class StartProtheusSyncDto {
  @ApiProperty({
    example: 'chart_of_accounts',
    description: 'chart_of_accounts | trial_balance | customers',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  resource!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class FetchProtheusResourceDto {
  @ApiProperty({
    example: 'chart_of_accounts',
    description: 'Recurso a buscar. Use chart_of_accounts para plano de contas (CT1).',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  resource!: string;

  @ApiPropertyOptional({
    example: '/api/meuservico/v1/planocontas',
    description:
      'Caminho REST publicado no Protheus (aparece em /rest). Se omitido, usa o padrão Clarity.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  pathOverride?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class DiscoverProtheusDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
