const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
/** @type {any} */
const storage = windowObj.localStorage;

// Vite só injeta env com o padrão literal `import.meta.env.*`.
// @ts-ignore
const envAppId = import.meta.env.VITE_BASE44_APP_ID;
// @ts-ignore
const envFunctionsVersion = import.meta.env.VITE_BASE44_FUNCTIONS_VERSION;
// @ts-ignore
const envAppBaseUrl = import.meta.env.VITE_BASE44_APP_BASE_URL;
const localTestAuth =
	// @ts-ignore
	import.meta.env.DEV === true &&
	// @ts-ignore
	import.meta.env.VITE_LOCAL_TEST_AUTH === 'true';

// Modo local: limpa URL/token Base44 antigos do localStorage (evita redirect para a nuvem).
if (!isNode && localTestAuth) {
	[
		'base44_app_id',
		'base44_app_base_url',
		'base44_access_token',
		'base44_from_url',
		'token',
	].forEach((key) => storage.removeItem(key));
}

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	// Env explícito (mesmo vazio) prevalece sobre valor antigo no localStorage.
	if (defaultValue !== undefined && defaultValue !== null) {
		if (defaultValue === '') {
			storage.removeItem(storageKey);
			return null;
		}
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}

/** Evita from_url recursivo (/login?from_url=/login?from_url=...) que estoura em HTTP 414. */
const sanitizeFromUrl = (raw) => {
	if (!raw || typeof raw !== 'string') return null;
	if (raw.length > 2048) return null;
	try {
		const u = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
		const path = (u.pathname || '').toLowerCase();
		if (path === '/login' || path.endsWith('/login')) return null;
		if (u.searchParams.has('from_url')) {
			u.searchParams.delete('from_url');
		}
		return u.toString();
	} catch {
		return null;
	}
};

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}
	// Limpa URL já contaminada por loop de from_url (ex.: bookmark /login?from_url=...).
	if (!isNode && typeof window !== 'undefined') {
		const path = (window.location.pathname || '').toLowerCase();
		const params = new URLSearchParams(window.location.search);
		if ((path === '/login' || params.has('from_url')) && params.get('from_url')?.includes('from_url')) {
			window.history.replaceState({}, document.title, '/');
			storage.removeItem('base44_from_url');
		}
	}
	const rawFromUrl = getAppParamValue("from_url", { defaultValue: undefined, removeFromUrl: true });
	const fromUrl = sanitizeFromUrl(rawFromUrl) || sanitizeFromUrl(
		!isNode && typeof window !== 'undefined' ? `${window.location.origin}/` : null,
	);
	return {
		appId: getAppParamValue("app_id", { defaultValue: envAppId }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl,
		functionsVersion: getAppParamValue("functions_version", { defaultValue: envFunctionsVersion }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: envAppBaseUrl }),
	}
}


export const appParams = {
	...getAppParams()
}
