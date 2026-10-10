import { Effect, Layer } from "effect";
import { type FleetHost, HostFailure } from "#host/config.ts";
import { CodexLocalConfig, codexLocalLayer } from "#providers/codexLocal.ts";
import { SessionTransport } from "#session/service.ts";

export function hostProvider(host: FleetHost) {
	switch (host.provider) {
		case "local": {
			if (host.local === undefined) {
				return Layer.effect(SessionTransport)(
					Effect.fail(new HostFailure({ message: 'provider "local" needs local.endpoint in the host configuration' })),
				);
			}
			return codexLocalLayer.pipe(
				Layer.provide(Layer.succeed(CodexLocalConfig)({ endpoint: host.local.endpoint, requestTimeoutMs: host.local.requestTimeoutMs ?? 30_000 })),
			);
		}
		case "cloud":
			return Layer.effect(SessionTransport)(Effect.fail(new HostFailure({ message: 'provider "cloud" is not wired into this host yet' })));
	}
}

export function workerCwd(host: FleetHost, repositoryRoot: string) {
	return host.provider === "cloud" && host.cloud !== undefined ? host.cloud.cwd : repositoryRoot;
}
