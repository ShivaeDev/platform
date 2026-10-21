import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { Context, Effect, Layer, Schema } from "effect";
import { HttpServer } from "effect/http";
import type { HostConfig } from "#host/config.ts";
import type { ConfigStatus } from "#host/configSettings.ts";
import { daemonLayer } from "#host/daemon.ts";
import type { FleetRecord } from "#model.ts";
import { type FleetConfiguration, FleetPolicy } from "#policy.ts";
import { waitForRecord } from "#test/daemonActions.ts";
import { daemonClient } from "#test/daemonClient.ts";
import type { HostFixture } from "#test/fleetHost.ts";

const ConfigFile = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

export const withReloadDaemon = Effect.fn("ConfigReloadTest.withReloadDaemon")(function* <A, E, R>(
	fixture: HostFixture,
	use: (daemon: ReloadDaemon) => Effect.Effect<A, E, R>,
) {
	const context = yield* Layer.build(daemonLayer(fixture.host, fixture.parts, 0));
	const client = yield* daemonClient(HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address));
	const config = Effect.fn("ConfigReloadTest.config")(
		function* (ready: (config: ConfigStatus) => boolean) {
			while (true) {
				const current = (yield* client("daemon.status", {})).config;
				if (current !== undefined && ready(current)) {
					return current;
				}
				yield* Effect.sleep("20 millis");
			}
		},
		(effect) => effect.pipe(Effect.timeout("10 seconds")),
	);
	let written = yield* Schema.decodeUnknownEffect(ConfigFile)(readFileSync(fixture.configFile, "utf8"));
	const daemon: ReloadDaemon = {
		client,
		config,
		edit: (settings) =>
			Effect.sync(() => {
				written = { ...written, ...settings };
				writeFileSync(fixture.configFile, JSON.stringify(written));
			}),
		editText: (text) => Effect.sync(() => writeFileSync(fixture.configFile, text)),
		launched: (workId) => waitForRecord(client, workId, (record) => record.step === "working" && record.attempts.at(-1)?.receipt !== undefined),
		policy: Effect.suspend(() => {
			const policy = Context.get(context, FleetPolicy);
			return policy.current ?? Effect.succeed(policy);
		}),
		replace: (settings) =>
			Effect.sync(() => {
				written = { ...written, ...settings };
				writeFileSync(`${fixture.configFile}.saving`, JSON.stringify(written));
				renameSync(`${fixture.configFile}.saving`, fixture.configFile);
			}),
		waiting: (workId) =>
			waitForRecord(client, workId, (record) => record.step === "queued" && record.attempts.length === 0 && record.blocker !== undefined),
	};
	return yield* use(daemon);
}, Effect.scoped);

export interface ReloadDaemon {
	readonly client: Effect.Success<ReturnType<typeof daemonClient>>;
	readonly config: (ready: (config: ConfigStatus) => boolean) => Effect.Effect<ConfigStatus, unknown>;
	readonly edit: (settings: Partial<HostConfig>) => Effect.Effect<void>;
	readonly editText: (text: string) => Effect.Effect<void>;
	readonly launched: (workId: string) => Effect.Effect<FleetRecord, unknown>;
	readonly policy: Effect.Effect<FleetConfiguration>;
	readonly replace: (settings: Partial<HostConfig>) => Effect.Effect<void>;
	readonly waiting: (workId: string) => Effect.Effect<FleetRecord, unknown>;
}
