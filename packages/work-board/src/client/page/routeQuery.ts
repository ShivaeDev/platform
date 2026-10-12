import type { BrowserClient } from "#client/client.ts";

interface PageApi {
	readonly document: Pick<BrowserClient["api"]["document"], "query">;
	readonly page: Pick<BrowserClient["api"]["page"], "query">;
}

export const routeQueryOptions = { timeToLive: 60_000 };

export function documentQuery(api: PageApi, url: string) {
	return api.document.query({ url }, routeQueryOptions);
}

export function pageQuery(api: PageApi, url: string) {
	return api.page.query({ url }, routeQueryOptions);
}
