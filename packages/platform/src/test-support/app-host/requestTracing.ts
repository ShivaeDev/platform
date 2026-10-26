import { Effect } from "effect";
import { Authenticated, RequestTracing } from "@shivaedev/identity/middleware.ts";
import { appHost } from "#server/appHost.ts";
import { sessions } from "./fixture.ts";
import { AuthenticatedPing, Ping, pingHandlers } from "./ping.ts";
import { host } from "./story.ts";

export const defectiveRpc = host.trait("configured", "an untraced loopback RPC handler defects", (state) => {
	function build() {
		return appHost({
			config: state.config,
			group: Ping,
			handlers: Ping.toLayer({ ping: () => Effect.die(new Error("password=hidden-defect-password")) }),
			policy: "loopback",
		});
	}
	state.build = build;
});

export function tracingDeclaration(position: "omitted" | "first" | "last") {
	return host.trait("configured", `the shared group's tracing declaration is ${position}`, (state) => {
		const authenticated = AuthenticatedPing;
		function build() {
			const options = { config: state.config, handlers: pingHandlers, sessions: sessions(state.lookups) };
			if (position === "omitted") {
				return appHost({ ...options, group: authenticated });
			}
			const group = position === "first" ? Ping.middleware(RequestTracing).middleware(Authenticated) : authenticated.middleware(RequestTracing);
			return appHost({ ...options, group });
		}
		state.build = build;
	});
}

export const traceEcho = host.trait("configured", "a loopback handler returns its trace without an installed exporter", (state) => {
	function build() {
		return appHost({
			config: state.config,
			group: Ping,
			handlers: Ping.toLayer({ ping: () => Effect.map(Effect.currentParentSpan, (span) => span.traceId).pipe(Effect.orDie) }),
			policy: "loopback",
		});
	}
	state.build = build;
});
