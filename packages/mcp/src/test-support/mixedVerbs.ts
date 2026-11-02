import { Effect } from "effect";
import { type Engine, named, person } from "./host.ts";
import { sessionIdentity } from "./sessionRpc.ts";

interface Credentials {
	readonly bearer?: string;
	readonly cookie?: string;
}

export function mixedVerbs(engine: Engine, tell: (line: string) => void) {
	function headers({ bearer, cookie }: Credentials) {
		return {
			...(bearer === undefined ? {} : { authorization: `Bearer ${engine.tokens.get(bearer) ?? ""}` }),
			...(cookie === undefined ? {} : { cookie: person(engine, cookie).cookie }),
		};
	}
	return {
		connectWith: (credentials: Credentials) =>
			Effect.promise(async () => {
				tell(`a client connects to MCP with ${JSON.stringify(credentials)}`);
				const response = await fetch(`${engine.baseUrl}/mcp`, { headers: headers(credentials) });
				await response.arrayBuffer();
				return { challenge: response.headers.get("www-authenticate"), status: response.status };
			}),
		readCookieRpc: (credentials: Credentials) =>
			Effect.suspend(() => {
				tell(`a client calls the cookie RPC with ${JSON.stringify(credentials)}`);
				return sessionIdentity(engine.baseUrl, headers(credentials)).pipe(Effect.map((answer) => named(engine, answer)));
			}),
	};
}
