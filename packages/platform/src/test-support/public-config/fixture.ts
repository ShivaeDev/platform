import { Config, Layer, Schema } from "effect";
import { publicConfig } from "#rpc/publicConfig.ts";
import { appHost } from "#server/appHost.ts";
import { publicConfigLayer } from "#server/rpc-server/publicConfigLayer.ts";
import { sessions } from "#test/app-host/fixture.ts";
import { AuthenticatedPing, pingHandlers } from "#test/app-host/ping.ts";
import type { HostState } from "#test/app-host/state.ts";

export const PublicConfig = publicConfig(
	Schema.Struct({ installUrl: Schema.URL, retryLimit: Schema.NumberFromString }).pipe(
		Schema.encodeKeys({ installUrl: "INSTALL_URL", retryLimit: "RETRY_LIMIT" }),
	),
);

export function configuredHost(state: HostState, path?: string) {
	return appHost({
		config: { port: 0 },
		group: AuthenticatedPing.merge(PublicConfig),
		handlers: Layer.merge(pingHandlers, publicConfigLayer(PublicConfig, path)),
		services: Layer.effectDiscard(Config.Redacted("SERVER_SECRET")),
		sessions: sessions(state.lookups),
	});
}
