import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { canWrite, isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../auth/auth.types';
import { CreateFinancialUploadMetaDto, UpdateFinancialUploadDto } from './dto/financial.dto';

@Injectable()
export class FinancialUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  private rlsOpts(actor: AuthUser, tenantId?: string | null) {
    return { tenantId: tenantId ?? actor.tenantId, isHq: isHQ(actor.role) };
  }

  private assertTenantAccess(actor: AuthUser, tenantId: string) {
    if (isHQ(actor.role)) return;
    if (actor.tenantId !== tenantId) throw new ForbiddenException('Tenant scope violation');
  }

  async list(actor: AuthUser, financialDiagnosisId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialUpload.findMany({
        where: { financialDiagnosisId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async get(actor: AuthUser, id: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const upload = await tx.financialUpload.findFirst({ where: { id, deletedAt: null } });
      if (!upload) throw new NotFoundException('FinancialUpload not found');
      return upload;
    });
  }

  /**
   * Passo 1 (equivalente a base44.integrations.Core.UploadFile): só grava
   * os bytes no MinIO e devolve a chave do objeto — ainda não sabe a que
   * diagnóstico/tenant o arquivo pertence (o frontend só descobre isso ao
   * chamar create() logo em seguida, exatamente como fazia com a Base44).
   */
  async uploadFile(actor: AuthUser, file: { originalname: string; buffer: Buffer; mimetype?: string }) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    if (!file?.buffer?.length) throw new ForbiddenException('Arquivo vazio ou ausente.');
    const objectKey = `${actor.tenantId ?? 'hq'}/${randomUUID()}-${file.originalname}`;
    await this.storage.putFile(objectKey, file.buffer, file.mimetype);
    return { file_url: objectKey, fileUrl: objectKey };
  }

  /** Passo 2: cria o registro FinancialUpload a partir de um fileUrl já gravado. */
  async create(actor: AuthUser, meta: CreateFinancialUploadMetaDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({
        where: { id: meta.financialDiagnosisId, deletedAt: null },
      });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      this.assertTenantAccess(actor, diagnosis.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        diagnosis.tenantId,
      );

      const previousCount = await tx.financialUpload.count({
        where: { financialDiagnosisId: diagnosis.id, deletedAt: null },
      });
      const isCurrent = meta.isCurrent ?? true;

      const upload = await tx.financialUpload.create({
        data: {
          tenantId: diagnosis.tenantId,
          financialDiagnosisId: diagnosis.id,
          fileName: meta.fileName,
          fileUrl: meta.fileUrl,
          versionNumber: meta.versionNumber ?? previousCount + 1,
          uploadStatus: 'pending',
          isCurrent,
          replacementStatus: meta.replacementStatus,
          sourceKey: meta.sourceKey,
          inputChecksum: meta.inputChecksum,
          sourceEntityId: meta.sourceEntityId,
          sourceEntityType: meta.sourceEntityType,
          sourceEntityName: meta.sourceEntityName,
          sourcePeriod: meta.sourcePeriod,
          notes: meta.notes,
        },
      });

      if (isCurrent) {
        await tx.financialDiagnosis.update({
          where: { id: diagnosis.id },
          data: { currentUploadId: upload.id },
        });
      }

      await this.audit.log({
        actorId: actor.id,
        tenantId: diagnosis.tenantId,
        action: 'financial_upload.create',
        entityType: 'financial_upload',
        entityId: upload.id,
        metadata: { fileName: meta.fileName },
      });
      return upload;
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateFinancialUploadDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.financialUpload.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw new NotFoundException('FinancialUpload not found');
      this.assertTenantAccess(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const data: Record<string, unknown> = {};
      if (dto.sourcePeriod !== undefined) data.sourcePeriod = dto.sourcePeriod;
      if (dto.notes !== undefined) data.notes = dto.notes;
      if (dto.isCurrent !== undefined) data.isCurrent = dto.isCurrent;
      return tx.financialUpload.update({ where: { id }, data });
    });
  }

  /** Soft-delete + best-effort remoção do objeto no MinIO. */
  async delete(actor: AuthUser, id: string) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.financialUpload.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw new NotFoundException('FinancialUpload not found');
      this.assertTenantAccess(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const upload = await tx.financialUpload.update({
        where: { id },
        data: { deletedAt: new Date(), isCurrent: false },
      });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'financial_upload.delete',
        entityType: 'financial_upload',
        entityId: id,
      });
      return upload;
    });
  }
}
