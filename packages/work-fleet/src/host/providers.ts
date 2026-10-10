import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { type FleetHost, HostFailure } from "#host/config.ts";
import { CodexCloudConfig, codexCloudLayer } from "#providers/codexCloud.ts";
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
		case "cloud": {
			if (host.cloud === undefined) {
				return Layer.effect(SessionTransport)(
					Effect.fail(new HostFailure({ message: 'provider "cloud" needs cloud settings in the host configuration' })),
				);
			}
			const { requestTimeoutMs = 60_000, ...cloud } = host.cloud;
			return codexCloudLayer.pipe(Layer.provide([Layer.succeed(CodexCloudConfig)({ ...cloud, requestTimeoutMs }), NodeServices.layer]));
		}
	}
}

export function workerCwd(host: FleetHost, repositoryRoot: string) {
	return host.provider === "cloud" && host.cloud !== undefined ? host.cloud.cwd : repositoryRoot;
}
