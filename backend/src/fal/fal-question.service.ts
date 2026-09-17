import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFalQuestionDto, ListFalQuestionsQueryDto } from './dto/fal.dto';

@Injectable()
export class FalQuestionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Banco global — sem tenant_id, não passa por withTenantContext. */
  async list(query: ListFalQuestionsQueryDto) {
    const where: Prisma.FalQuestionWhereInput = {};
    if (query.dimensionKey) where.dimensionKey = query.dimensionKey;
    if (query.clusterKey) where.clusterKey = query.clusterKey;
    if (query.ids) {
      where.id = { in: query.ids.split(',').filter(Boolean) };
    }
    return this.prisma.falQuestion.findMany({
      where,
      orderBy: { sequenceOrder: 'asc' },
    });
  }

  async get(id: string) {
    const question = await this.prisma.falQuestion.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('FalQuestion not found');
    return question;
  }

  async create(dto: CreateFalQuestionDto) {
    return this.prisma.falQuestion.create({
      data: {
        questionId: dto.questionId,
        dimensionKey: dto.dimensionKey,
        subdimensionKey: dto.subdimensionKey,
        clusterKey: dto.clusterKey,
        processStage: dto.processStage,
        sequenceOrder: dto.sequenceOrder ?? 0,
        diagnosticDepth: dto.diagnosticDepth ?? [],
        levelApplicability: dto.levelApplicability ?? [],
        questionWeight: dto.questionWeight ?? 1,
        questionText: dto.questionText,
        guidance: dto.guidance,
        evidenceHint: dto.evidenceHint,
        isKillerQuestion: dto.isKillerQuestion ?? false,
        isCritical: dto.isCritical ?? false,
        dependency: dto.dependency,
      },
    });
  }
}
