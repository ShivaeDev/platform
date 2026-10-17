import type { IFetchInterceptor } from "happy-dom";
import FetchRequestHeaderUtility from "happy-dom/lib/fetch/utilities/FetchRequestHeaderUtility.js";
import WindowBrowserContext from "happy-dom/lib/window/WindowBrowserContext.js";
import { documentRedirect } from "#internal/documentRedirect.ts";
import { documentRequest } from "#internal/documentRequest.ts";
import { documentResponse, documentResponseHeaders } from "#internal/documentResponse.ts";

export function documentTransport(fetch: typeof globalThis.fetch): IFetchInterceptor {
	return {
		async beforeAsyncRequest({ request, window }) {
			const frame = new WindowBrowserContext(window).getBrowserFrame();
			if (!frame) {
				throw new Error("test-story cannot fetch after the document has closed");
			}
			let current = request;
			let body = current.body === null ? null : Buffer.from(await current.arrayBuffer());
			for (let redirects = 0; redirects <= 20; redirects += 1) {
				const headers = FetchRequestHeaderUtility.getRequestHeaders({ browserFrame: frame, request: current, window });
				delete headers.Connection;
				const { release, response } = await documentRequest(fetch, current, body, headers);
				const responseHeaders = documentResponseHeaders(response, current, frame);
				const location = response.headers.get("location");
				if (![301, 302, 303, 307, 308].includes(response.status) || location === null || current.redirect === "manual") {
					return documentResponse(response, current, frame, release, redirects > 0, responseHeaders);
				}
				await response.body?.cancel();
				release();
				if (current.redirect === "error" || redirects === 20) {
					throw new Error(`test-story cannot follow redirect from ${current.url}`);
				}
				const next = documentRedirect(current, window, new URL(location, current.url), response.status, body);
				current = next.request;
				body = next.body;
			}
			throw new Error(`test-story reached the redirect limit for ${request.url}`);
		},
		beforeSyncRequest({ request }) {
			throw new Error(`test-story refuses synchronous document requests to ${new URL(request.url).hostname}; use fetch instead`);
		},
	};
}
