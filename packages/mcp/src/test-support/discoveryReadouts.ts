import { Effect } from "effect";
import { type Engine, path } from "./host.ts";

function json(url: string) {
	return Effect.promise(async () => {
		const response = await fetch(url);
		const body = await response.text();
		if (!response.ok) {
			throw new Error(`${url} answered ${response.status}: ${body}`);
		}
		return JSON.parse(body);
	});
}

const RESOURCE_METADATA = "/.well-known/oauth-protected-resource/mcp";

export function discoveryReadouts(engine: Engine) {
	function resourceMetadata() {
		return json(new URL(RESOURCE_METADATA, engine.baseUrl).href);
	}
	return {
		resourceMetadata: () =>
			Effect.map(resourceMetadata(), (metadata) => ({
				authorizationServers: metadata.authorization_servers.map((url: string) => path(engine, url)),
				resource: path(engine, metadata.resource),
				scopes: metadata.scopes_supported,
			})),
		tokenEndpointOfItsAuthorizationServer: () =>
			Effect.gen(function* () {
				const issuer = new URL((yield* resourceMetadata()).authorization_servers[0]);
				const metadata = yield* json(new URL(`/.well-known/oauth-authorization-server${issuer.pathname}`, issuer).href);
				return path(engine, metadata.token_endpoint);
			}),
	};
}
