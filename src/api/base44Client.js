import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { LOCAL_TEST_AUTH_ENABLED } from '@/lib/localTestAuth';
import { createLocalBase44Client } from '@/api/localBase44Client';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Tipagem frouxa: o client local e o SDK compartilham a mesma superfície de uso no app.
/** @type {any} */
export const base44 = LOCAL_TEST_AUTH_ENABLED
  ? createLocalBase44Client()
  : createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: '',
      requiresAuth: true,
      appBaseUrl,
    });
