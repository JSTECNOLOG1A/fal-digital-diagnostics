import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

/**
 * Wrapper fino sobre o MinIO (S3-compatible) já provisionado no
 * docker-compose (serviço `minio`, bucket usado hoje: financial-uploads).
 *
 * Usado para persistir os arquivos de balancete/plano de contas enviados
 * pelo usuário — hoje esses uploads não têm nenhum armazenamento real no
 * ambiente local (o Base44 original guardava o arquivo na própria
 * plataforma via `file_url`).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  private readonly bucket: string;
  private ready = false;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'financial-uploads');
    this.client = new Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', '127.0.0.1'),
      port: Number(this.config.get('MINIO_PORT', 9100)),
      useSSL: false,
      accessKey: this.config.get<string>('MINIO_ROOT_USER', 'fal'),
      secretKey: this.config.get<string>('MINIO_ROOT_PASSWORD', ''),
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket MinIO "${this.bucket}" criado.`);
      }
      this.ready = true;
    } catch (err) {
      // Não derruba o boot da API por causa do MinIO — upload/validação
      // financeira vão falhar com erro claro na hora de usar, mas o resto
      // do sistema (hierarquia, auth etc.) continua funcionando.
      this.logger.warn(
        `MinIO indisponível no boot (${(err as Error).message}). Uploads financeiros vão falhar até o MinIO subir.`,
      );
    }
  }

  private assertReady() {
    if (!this.ready) {
      throw new Error(
        'Armazenamento de arquivos (MinIO) indisponível. Confirme que o container "fal-minio" está rodando (docker compose up -d).',
      );
    }
  }

  /** Grava um arquivo e retorna a chave do objeto (a ser salva como file_url). */
  async putFile(objectKey: string, buffer: Buffer, contentType?: string): Promise<string> {
    this.assertReady();
    await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, {
      ...(contentType ? { 'Content-Type': contentType } : {}),
    });
    return objectKey;
  }

  /** Lê um arquivo de volta como Buffer (usado pela validação de upload). */
  async getFile(objectKey: string): Promise<Buffer> {
    this.assertReady();
    const stream = await this.client.getObject(this.bucket, objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  async removeFile(objectKey: string): Promise<void> {
    this.assertReady();
    await this.client.removeObject(this.bucket, objectKey);
  }
}
