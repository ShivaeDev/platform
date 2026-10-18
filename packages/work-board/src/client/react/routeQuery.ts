import type { BrowserClient } from "#client/client.ts";

interface PageApi {
	readonly document: Pick<BrowserClient["api"]["document"], "query">;
}

export const routeQueryOptions = { timeToLive: 60_000 };

export function documentQuery(api: PageApi, url: string) {
	return api.document.query({ url }, routeQueryOptions);
}

export function navigationQuery(api: { readonly navigation: Pick<BrowserClient["api"]["navigation"], "query"> }) {
	return api.navigation.query({ current: "" }, routeQueryOptions);
}
