import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { LOCAL_TEST_AUTH_ENABLED } from '@/lib/localTestAuth';
import { CLARITY_FEATURES } from '@/api/clarityClient';
import { createLocalBase44Client } from '@/api/localBase44Client';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

/**
 * Em produção, import.meta.env.DEV é false — LOCAL_TEST_AUTH_ENABLED sozinho
 * nunca liga. Com Clarity auth (ou Base44 desconectado / sem appBaseUrl),
 * NÃO usar o SDK com requiresAuth:true — ele redireciona para
 * /login?from_url=... em loop (HTTP 414 no nginx).
 */
const USE_REAL_BACKEND =
  LOCAL_TEST_AUTH_ENABLED ||
  CLARITY_FEATURES.useClarityAuth ||
  !appBaseUrl;

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
