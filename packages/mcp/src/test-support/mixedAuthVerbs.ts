import { Effect } from "effect";
import { POLICY_ONLY_ORIGIN, TRANSPORT_ONLY_ORIGIN } from "./application.ts";
import { browserIdentity } from "./browserRpc.ts";
import { connect } from "./client.ts";
import { type Engine, named, person } from "./host.ts";

export function mixedAuthVerbs(engine: Engine, tell: (line: string) => void) {
	const origins = { allowed: engine.baseUrl, "policy only": POLICY_ONLY_ORIGIN, "transport only": TRANSPORT_ONLY_ORIGIN };
	return {
		connectsFrom: (name: string, origin: "allowed" | "policy only" | "transport only") => {
			tell(`${name}'s client connects to MCP from the ${origin} origin`);
			return connect(engine, engine.tokens.get(name), "Bearer", {
				origin: origins[origin],
			}).pipe(Effect.map((client) => (typeof client === "string" ? client : "connected")));
		},
		connectsWithCookie: (cookieOwner: string, tokenOwner?: string) => {
			tell(`a client connects to MCP with ${cookieOwner}'s cookie${tokenOwner === undefined ? "" : ` and ${tokenOwner}'s bearer token`}`);
			return connect(engine, tokenOwner === undefined ? undefined : engine.tokens.get(tokenOwner), "Bearer", {
				cookie: person(engine, cookieOwner).cookie,
			}).pipe(Effect.map((client) => (typeof client === "string" ? client : "connected")));
		},
		readsBrowserIdentity: (credentials: { readonly cookie?: string; readonly bearer?: string }) => {
			tell("a client calls cookie-authenticated browserIdentity RPC");
			return browserIdentity(engine.baseUrl, {
				...(credentials.cookie === undefined ? {} : { cookie: person(engine, credentials.cookie).cookie }),
				...(credentials.bearer === undefined ? {} : { authorization: `Bearer ${engine.tokens.get(credentials.bearer)}` }),
			}).pipe(Effect.map((answer) => named(engine, answer)));
		},
	};
}
