import { Layer } from "effect";
import type { HttpRouter } from "effect/http";
import { trustedOrigins } from "@shivaedev/identity/server/adapters/trustedOrigins.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { appHost } from "#appHost.ts";
import { sessions } from "#test/app-host/fixture.ts";
import { Ping, pingHandlers } from "#test/app-host/ping.ts";
import { host } from "#test/app-host/story.ts";

export function siblingOrigins(allow: readonly string[], rpcPath: HttpRouter.PathInput = "/rpc") {
	return host.trait("configured", "identity declares the sibling browser origins", (state) => {
		state.rpcPath = rpcPath;
		state.build = () =>
			appHost({
				config: state.config,
				group: Ping,
				handlers: pingHandlers,
				rpcPath,
				services: Layer.empty,
				sessions: Layer.succeed(SessionPolicy, {
					...sessions(state.lookups),
					origin: trustedOrigins({ allow, missing: "allow" }),
				}),
			});
	});
}

export function corsResponse(response: { readonly headers: Headers; readonly status: number }) {
	return {
		credentials: response.headers.get("access-control-allow-credentials"),
		headers: response.headers.get("access-control-allow-headers"),
		methods: response.headers.get("access-control-allow-methods"),
		origin: response.headers.get("access-control-allow-origin"),
		status: response.status,
	};
}
