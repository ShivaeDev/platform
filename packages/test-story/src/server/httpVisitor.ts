import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { visitHttp } from "#adapters/visitHttp.ts";
import { type ForwardingProxyOptions, forwardingProxy } from "#forwardingProxy.ts";
import { visitorCookies } from "#internal/visitorCookies.ts";

export interface HttpVisitorOptions {
	readonly baseUrl?: string;
	readonly edge?: ForwardingProxyOptions;
	readonly headers?: HeadersInit;
}

export type VisitorRequest = Omit<RequestInit, "credentials" | "redirect">;

export const httpVisitor = Effect.fnUntraced(function* (upstream: string, options: HttpVisitorOptions = {}) {
	const edge = yield* forwardingProxy(upstream, options.edge);
	const cookies = visitorCookies();
	const baseUrl = options.baseUrl ?? upstream;
	return {
		request: Effect.fnUntraced(function* (path: string, init: VisitorRequest = {}) {
			const url = new URL(path, baseUrl);
			const headers = new Headers(options.headers);
			new Headers(init.headers).forEach((value, name) => {
				headers.set(name, value);
			});
			headers.set("x-forwarded-host", url.host);
			headers.set("x-forwarded-proto", url.protocol.slice(0, -1));
			const cookie = cookies.header(url, yield* Clock.currentTimeMillis);
			if (cookie !== "") {
				headers.set("cookie", cookie);
			}
			const response = yield* Effect.tryPromise((signal) => visitHttp(`${edge.url}${url.pathname}${url.search}`, { ...init, headers }, signal));
			cookies.keep(response.headers.getSetCookie(), url, yield* Clock.currentTimeMillis);
			return response;
		}),
	};
});
