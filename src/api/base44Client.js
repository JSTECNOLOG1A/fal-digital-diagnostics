import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { LOCAL_TEST_AUTH_ENABLED } from '@/lib/localTestAuth';
import { CLARITY_FEATURES } from '@/api/clarityClient';
import { createLocalBase44Client } from '@/api/localBase44Client';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Mesma condição usada por PASSWORD_LOGIN_ENABLED (AuthContext.jsx): em build
// de produção, import.meta.env.DEV é sempre false, então LOCAL_TEST_AUTH_ENABLED
// nunca é true por si só — sem o `|| CLARITY_FEATURES.useClarityAuth`, todo
// base44.entities.*/functions.invoke cairia no SDK antigo da nuvem Base44
// mesmo com o usuário autenticado de verdade contra o backend NestJS.
const USE_REAL_BACKEND = LOCAL_TEST_AUTH_ENABLED || CLARITY_FEATURES.useClarityAuth;

// Tipagem frouxa: o client local e o SDK compartilham a mesma superfície de uso no app.
/** @type {any} */
export const base44 = USE_REAL_BACKEND
  ? createLocalBase44Client()
  : createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: '',
      requiresAuth: true,
      appBaseUrl,
    });
