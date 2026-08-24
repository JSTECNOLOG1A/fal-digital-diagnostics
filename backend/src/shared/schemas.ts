import { z } from 'zod';
import { ALL_ROLES } from './roles';

export const appRoleSchema = z.enum(
  ALL_ROLES as [string, ...string[]],
);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  role: appRoleSchema,
  tenantId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  temporaryPassword: z.string().min(8).max(128).optional(),
});

export const revokeUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const createGroupSchema = z.object({
  name: z.string().min(2).max(160),
  tenantId: z.string().uuid().optional(),
});

export const createCompanySchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(2).max(160),
  cnpj: z
    .string()
    .regex(/^\d{14}$/)
    .optional(),
  sector: z.string().max(120).optional(),
  erpSystem: z.string().max(80).optional(),
  tenantId: z.string().uuid().optional(),
});

export const createOperationalUnitSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(2).max(160),
  code: z.string().max(40).optional(),
  tenantId: z.string().uuid().optional(),
});

export const protheusConnectionSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(256),
  companyCode: z.string().min(1).max(20),
  branchCode: z.string().min(1).max(20).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
