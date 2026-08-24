import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { IntegrationsService } from './integrations.service';
import {
  ApiKeyGuard,
  ApiKeyPrincipal,
  assertScope,
} from './guards/api-key.guard';

@ApiTags('integrations/partner')
@ApiHeader({ name: 'X-Api-Key', required: true })
@Controller('integrations/partner')
export class IntegrationsPartnerController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Public()
  @UseGuards(ApiKeyGuard)
  @Get('ping')
  ping(@Req() req: { apiKeyPrincipal: ApiKeyPrincipal }) {
    assertScope(req.apiKeyPrincipal, 'partner:ping');
    return this.integrations.partnerPing(req.apiKeyPrincipal);
  }

  /**
   * Webhook inbound: sistemas externos empurram eventos para o FAL.
   * Auth via X-Api-Key (scope webhooks:receive).
   */
  @Public()
  @UseGuards(ApiKeyGuard)
  @Post('webhooks/:provider')
  receiveWebhook(
    @Req() req: { apiKeyPrincipal: ApiKeyPrincipal; headers: Record<string, unknown> },
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
  ) {
    assertScope(req.apiKeyPrincipal, 'webhooks:receive');
    return this.integrations.receiveInbound(
      req.apiKeyPrincipal,
      provider,
      body ?? {},
      {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'x-request-id': req.headers['x-request-id'],
      },
    );
  }
}
