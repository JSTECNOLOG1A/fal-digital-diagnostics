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

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}
	return {
		appId: getAppParamValue("app_id", { defaultValue: envAppId }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: envFunctionsVersion }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: envAppBaseUrl }),
	}
}


export const appParams = {
	...getAppParams()
}
