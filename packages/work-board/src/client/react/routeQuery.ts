import { libraryInput, libraryState } from "#browser/navigation/library.ts";
import type { BrowserClient } from "#browserClient.ts";
import { resultUrl } from "#responses/url.ts";

interface PageApi {
	readonly document: Pick<BrowserClient["api"]["document"], "query">;
}
interface ResultApi {
	readonly result: Pick<BrowserClient["api"]["result"], "query">;
}

export const routeQueryOptions = { timeToLive: 60_000 };

export function documentQuery(api: PageApi, url: string) {
	return api.document.query({ url }, routeQueryOptions);
}

export function resultQuery(api: ResultApi, item: string) {
	return api.result.query({ url: resultUrl(item) }, routeQueryOptions);
}

export function navigationQuery(api: { readonly navigation: Pick<BrowserClient["api"]["navigation"], "query"> }) {
	return api.navigation.query({ current: "" }, routeQueryOptions);
}

export function libraryQuery(api: { readonly library: Pick<BrowserClient["api"]["library"], "query"> }, url: string) {
	return api.library.query(libraryInput(libraryState(url)), routeQueryOptions);
}
