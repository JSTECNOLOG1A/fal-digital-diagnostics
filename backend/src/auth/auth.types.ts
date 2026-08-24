import { AppRole } from '../shared';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  tenantId: string | null;
  clientId: string | null;
};

export type JwtPayload = {
  sub: string;
  email: string;
  role: AppRole;
  tenantId: string | null;
  clientId: string | null;
  typ: 'access';
};
