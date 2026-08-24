import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProtheusController } from './protheus.controller';
import { ProtheusService } from './protheus.service';
import { AuditModule } from '../../audit/audit.module';
import { PROTHEUS_SYNC_QUEUE } from './protheus.constants';

@Module({
  imports: [
    AuditModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url =
          config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379') ||
          'redis://127.0.0.1:6379';
        // Node 25 + ioredis: "localhost" pode resolver em IPv6 e travar o bootstrap
        const normalized = url.replace('://localhost', '://127.0.0.1');
        return {
          connection: {
            url: normalized,
            family: 4,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: PROTHEUS_SYNC_QUEUE }),
  ],
  controllers: [ProtheusController],
  providers: [ProtheusService],
  exports: [ProtheusService],
})
export class ProtheusModule {}
