import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

const ALL_DIMS = ['governanca', 'juridico', 'controles_internos', 'financeiro', 'contabil', 'tributario', 'operacional', 'sistemas'];
const DIM_AXIS: Record<string, string> = {
  governanca: 'Governança', juridico: 'Jurídico / Societário', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia / Sistemas',
};
const GROUP_PRIORITY_DIMS = new Set(['governanca', 'juridico', 'controles_internos']);

function scoreToLevel(s: number | null): string {
  if (s === null || s === undefined || isNaN(s)) return 'N/A';
  if (s < 1.0) return 'Crítico';
  if (s < 1.8) return 'Básico';
  if (s < 2.5) return 'Estruturado';
  return 'Avançado';
}

@Injectable()
export class FalAggregateService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  /**
   * IDs de MethodVersion com banco de perguntas PRÓPRIO (ex.: Reforma
   * Tributária 8D) — essas dimension_key reaproveitam as mesmas chaves do
   * FAL 8D clássico com outro significado/peso e não devem entrar neste
   * agregado. Não dá pra filtrar por "methodVersionId: null" porque o
   * Assessment do FAL 8D clássico normalmente JÁ aponta pra um MethodVersion
   * real (via useTenant().methodVersion) — só o FalQuestion do FAL 8D é que
   * fica com methodVersionId nulo. Resolve dinamicamente, sem hardcodar
   * nenhum código de método.
   */
  private async dedicatedMethodVersionIds(tx: any): Promise<string[]> {
    const rows = await tx.falQuestion.findMany({
      where: { methodVersionId: { not: null } },
      distinct: ['methodVersionId'],
      select: { methodVersionId: true },
    });
    return rows.map((r: any) => r.methodVersionId).filter(Boolean);
  }

  /** Porta de base44/functions/computeCompanyAggregate. */
  async computeCompanyAggregate(actor: AuthUser, companyId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const company = await tx.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) throw new NotFoundException('Company not found');
      if (!isHQ(actor.role) && actor.tenantId && company.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Forbidden');
      }

      // Exclui assessments de métodos com banco de perguntas próprio (ex.:
      // Reforma Tributária 8D) — ver dedicatedMethodVersionIds(). OR explícito
      // com methodVersionId:null porque `notIn` sozinho, em SQL, exclui linhas
      // NULL (lógica de três valores) — precisa incluir null manualmente.
      const excludedMethodIds = await this.dedicatedMethodVersionIds(tx);
      const notDedicatedMethod = { OR: [{ methodVersionId: null }, { methodVersionId: { notIn: excludedMethodIds } }] };
      const [unitAssessments, companyAssessments, units] = await Promise.all([
        tx.assessment.findMany({ where: { companyId, targetType: 'unit', ...notDedicatedMethod }, orderBy: { createdAt: 'desc' }, take: 100 }),
        tx.assessment.findMany({ where: { targetType: 'company', targetId: companyId, ...notDedicatedMethod }, orderBy: { createdAt: 'desc' }, take: 10 }),
        tx.operationalUnit.findMany({ where: { companyId, deletedAt: null } }),
      ]);

      const unitSnapshotMap = new Map<string, { snapshot: any; assessment: any }>();
      for (const a of unitAssessments) {
        if (!a.unitId || unitSnapshotMap.has(a.unitId)) continue;
        const snap = await tx.falDiagnosticSnapshot.findFirst({ where: { assessmentId: a.id }, orderBy: { computedAt: 'desc' } });
        if (snap) unitSnapshotMap.set(a.unitId, { snapshot: snap, assessment: a });
      }

      let companySnap: any = null;
      if (companyAssessments.length > 0) {
        companySnap = await tx.falDiagnosticSnapshot.findFirst({
          where: { assessmentId: companyAssessments[0].id }, orderBy: { computedAt: 'desc' },
        });
      }

      const allSnapshots = [
        ...[...unitSnapshotMap.values()].map((v) => ({ ...v, source: 'unit' })),
        ...(companySnap ? [{ snapshot: companySnap, assessment: companyAssessments[0], source: 'company' }] : []),
      ];

      if (allSnapshots.length === 0) {
        return { aggregate: null, message: 'Nenhum snapshot disponível' };
      }

      const dimAccum: Record<string, { sum: number; count: number }> = {};
      for (const dim of ALL_DIMS) dimAccum[dim] = { sum: 0, count: 0 };
      for (const { snapshot } of allSnapshots) {
        const ds = (snapshot.dimensionScores as any) || {};
        for (const dim of ALL_DIMS) {
          const d = ds[dim];
          if (d && d.active !== false && d.score !== null && d.score !== undefined) {
            dimAccum[dim].sum += d.score;
            dimAccum[dim].count += 1;
          }
        }
      }

      const dimensionScores: Record<string, any> = {};
      const radarPoints: any[] = [];
      let scoreSum = 0, scoreCount = 0;
      for (const dim of ALL_DIMS) {
        const { sum, count } = dimAccum[dim];
        if (count > 0) {
          const score = Math.round((sum / count) * 100) / 100;
          const level = scoreToLevel(score);
          dimensionScores[dim] = { score, level, source_count: count, active: true };
          radarPoints.push({ axis: DIM_AXIS[dim], dimension: dim, score, level, active: true });
          scoreSum += score; scoreCount++;
        } else {
          dimensionScores[dim] = { score: null, level: 'N/A', source_count: 0, active: false };
          radarPoints.push({ axis: DIM_AXIS[dim], dimension: dim, score: 0, level: 'N/A', active: false });
        }
      }

      const overallScore = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 100) / 100 : 0;
      const overallLevel = scoreToLevel(overallScore);

      const sourceAssessments = allSnapshots.map(({ snapshot, assessment, source }) => ({
        assessment_id: assessment.id, title: assessment.title, target_type: assessment.targetType,
        target_id: assessment.targetId, unit_id: assessment.unitId,
        overall_score: Number(snapshot.overallScore), computed_at: snapshot.computedAt, source,
      }));

      const saved = await tx.falAggregateSnapshot.upsert({
        where: { levelType_levelId: { levelType: 'company', levelId: companyId } },
        update: {
          computedAt: new Date(), computedBy: actor.email, overallScore, overallLevel,
          dimensionScores, radarPoints, sourceAssessments, aggregationRule: 'mean',
        },
        create: {
          tenantId: company.tenantId, levelType: 'company', levelId: companyId,
          computedBy: actor.email, overallScore, overallLevel,
          dimensionScores, radarPoints, sourceAssessments, aggregationRule: 'mean',
        },
      });

      return { ...saved, overallScore, unitsCount: units.length, snapshotsUsed: allSnapshots.length };
    });
  }

  /** Porta de base44/functions/computeGroupAggregate. */
  async computeGroupAggregate(actor: AuthUser, groupId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const group = await tx.group.findFirst({ where: { id: groupId, deletedAt: null } });
      if (!group) throw new NotFoundException('Group not found');
      if (!isHQ(actor.role) && actor.tenantId && group.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Forbidden');
      }

      const companies = await tx.company.findMany({ where: { groupId, deletedAt: null }, orderBy: { name: 'asc' } });

      const companyAggregates: { company: any; agg: any }[] = [];
      for (const company of companies) {
        let agg = await tx.falAggregateSnapshot.findFirst({
          where: { levelType: 'company', levelId: company.id }, orderBy: { computedAt: 'desc' },
        });
        if (!agg) {
          const res = await this.computeCompanyAggregate(actor, company.id);
          agg = (res as any).aggregate === null ? null : (res as any);
        }
        if (agg && agg.overallScore !== null && agg.overallScore !== undefined) {
          companyAggregates.push({ company, agg });
        }
      }

      // Mesmo motivo do computeCompanyAggregate acima — ver dedicatedMethodVersionIds().
      const excludedGroupMethodIds = await this.dedicatedMethodVersionIds(tx);
      const groupAssessments = await tx.assessment.findMany({
        where: {
          targetType: 'group', targetId: groupId,
          OR: [{ methodVersionId: null }, { methodVersionId: { notIn: excludedGroupMethodIds } }],
        },
        orderBy: { createdAt: 'desc' }, take: 5,
      });
      let groupSnap: any = null;
      if (groupAssessments.length > 0) {
        groupSnap = await tx.falDiagnosticSnapshot.findFirst({
          where: { assessmentId: groupAssessments[0].id }, orderBy: { computedAt: 'desc' },
        });
      }

      if (companyAggregates.length === 0 && !groupSnap) {
        return { aggregate: null, message: 'Nenhum dado disponível para agregação' };
      }

      const dimAccum: Record<string, { wsum: number; wtotal: number }> = {};
      for (const dim of ALL_DIMS) dimAccum[dim] = { wsum: 0, wtotal: 0 };
      const entitySources: any[] = [];

      for (const { agg } of companyAggregates) {
        const ds = (agg.dimensionScores as any) || {};
        for (const dim of ALL_DIMS) {
          const d = ds[dim];
          if (d && d.active !== false && d.score !== null && d.score !== undefined) {
            dimAccum[dim].wsum += d.score;
            dimAccum[dim].wtotal += 1;
          }
        }
      }
      if (groupSnap) {
        const ds = (groupSnap.dimensionScores as any) || {};
        for (const dim of ALL_DIMS) {
          const d = ds[dim];
          if (!d || d.active === false || d.score === null || d.score === undefined) continue;

          // Assessment multi_entity_master: esta dimensão já foi calculada
          // por entidade (ver correção da colisão em computeDiagnostic) —
          // usar entity_scores dá a cada empresa seu próprio voto na média
          // do grupo, em vez de tratar o número já consolidado do
          // assessment como se fosse "a resposta do grupo inteiro" de novo
          // (o que dobraria o peso da consolidação e escondia quem
          // realmente respondeu).
          if (Array.isArray(d.entity_scores) && d.entity_scores.length > 0) {
            for (const e of d.entity_scores) {
              if (e.score === null || e.score === undefined) continue;
              dimAccum[dim].wsum += e.score;
              dimAccum[dim].wtotal += 1;
              entitySources.push({
                level: 'entity', dimension: dim, entity_id: e.entity_id, entity_name: e.entity_name,
                score: e.score, assessment_id: groupAssessments[0].id,
              });
            }
            continue;
          }

          // Dimensão sem quebra por entidade (ex.: governança medida uma
          // vez só para o grupo/holding) — mantém o peso de prioridade
          // original.
          const w = GROUP_PRIORITY_DIMS.has(dim) ? 2 : 1;
          dimAccum[dim].wsum += d.score * w;
          dimAccum[dim].wtotal += w;
        }
      }

      const dimensionScores: Record<string, any> = {};
      const radarPoints: any[] = [];
      let scoreSum = 0, scoreCount = 0;
      for (const dim of ALL_DIMS) {
        const { wsum, wtotal } = dimAccum[dim];
        if (wtotal > 0) {
          const score = Math.round((wsum / wtotal) * 100) / 100;
          const level = scoreToLevel(score);
          dimensionScores[dim] = { score, level, active: true };
          radarPoints.push({ axis: DIM_AXIS[dim], dimension: dim, score, level, active: true });
          scoreSum += score; scoreCount++;
        } else {
          dimensionScores[dim] = { score: null, level: 'N/A', active: false };
          radarPoints.push({ axis: DIM_AXIS[dim], dimension: dim, score: 0, level: 'N/A', active: false });
        }
      }

      const overallScore = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 100) / 100 : 0;
      const overallLevel = scoreToLevel(overallScore);

      const sourceAssessments = [
        ...companyAggregates.map(({ company, agg }) => ({
          level: 'company', company_id: company.id, company_name: company.name,
          overall_score: Number(agg.overallScore), computed_at: agg.computedAt,
        })),
        ...(groupSnap ? [{ level: 'group', assessment_id: groupAssessments[0].id, overall_score: Number(groupSnap.overallScore) }] : []),
        ...entitySources,
      ];

      const saved = await tx.falAggregateSnapshot.upsert({
        where: { levelType_levelId: { levelType: 'group', levelId: groupId } },
        update: {
          computedAt: new Date(), computedBy: actor.email, overallScore, overallLevel,
          dimensionScores, radarPoints, sourceAssessments, aggregationRule: 'weighted_mean',
        },
        create: {
          tenantId: group.tenantId, levelType: 'group', levelId: groupId,
          computedBy: actor.email, overallScore, overallLevel,
          dimensionScores, radarPoints, sourceAssessments, aggregationRule: 'weighted_mean',
        },
      });

      return { ...saved, overallScore, companiesCount: companies.length };
    });
  }
}
