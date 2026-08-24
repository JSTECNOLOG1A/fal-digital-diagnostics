import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    if (isHQ(user.role)) {
      return this.prisma.tenant.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
    }
    if (!user.tenantId) return [];
    return this.prisma.tenant.findMany({
      where: { id: user.tenantId, deletedAt: null },
    });
  }

  async get(user: AuthUser, id: string) {
    if (!isHQ(user.role) && user.tenantId !== id) {
      throw new NotFoundException('Tenant not found');
    }
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    const exists = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (exists) throw new ConflictException('Slug already in use');

    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        logoUrl: dto.logoUrl,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateTenantDto) {
    if (!isHQ(user.role) && user.tenantId !== id) {
      throw new ForbiddenException('Tenant scope violation');
    }
    const existing = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Tenant not found');

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
