import { Effect } from "effect";
import type { Host } from "./host.ts";
import { mintSession } from "./mint.ts";
import { originStream } from "./originStream.ts";

export function originVerbs(host: Host, tell: (line: string) => void) {
	function request(path: string, init?: RequestInit) {
		return Effect.promise(async () => {
			tell(`${init?.method ?? "GET"} ${path} over real HTTP`);
			const response = await fetch(`${host.baseUrl}${path}`, { ...init, credentials: "omit", signal: AbortSignal.timeout(5000) });
			return { body: await response.text(), headers: response.headers, status: response.status };
		});
	}
	return {
		lookups: () => host.activity.lookups,
		mintSession: () => mintSession(host),
		preflight: (path: string, origin: string) =>
			request(path, {
				headers: {
					"access-control-request-headers": "authorization, content-type",
					"access-control-request-method": "POST",
					origin,
				},
				method: "OPTIONS",
			}),
		profile: (owner: string, headers: Record<string, string>, messageHeaders: readonly (readonly [string, string])[] = []) =>
			request("/rpc", {
				body: `${JSON.stringify({ _tag: "Request", headers: messageHeaders, id: "0", payload: { owner }, tag: "native.profile" })}\n`,
				headers: { "content-type": "application/ndjson", ...headers },
				method: "POST",
			}),
		request,
		sameOrigin: () => host.baseUrl,
		stream: (origin: string, credential: string) => originStream(host, origin, credential),
	};
}
