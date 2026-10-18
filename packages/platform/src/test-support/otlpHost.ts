import { appHost } from "#server/appHost.ts";
import { sessions } from "#test/app-host/fixture.ts";
import { Ping, pingHandlers } from "#test/app-host/ping.ts";
import type { HostState } from "#test/app-host/state.ts";

export function otlpHost(state: HostState) {
	return appHost({
		...(state.assets === undefined ? {} : { assets: state.assets }),
		config: state.config,
		group: Ping,
		handlers: pingHandlers,
		routes: state.routes,
		rpcPath: state.rpcPath,
		...(state.loopback ? { policy: "loopback" as const } : { sessions: sessions(state.lookups) }),
	});
}
