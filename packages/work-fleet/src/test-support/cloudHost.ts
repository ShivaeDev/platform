import { Effect, Option, Stream } from "effect";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import type { HostConfig } from "#host/config.ts";
import { hostProvider } from "#host/providers.ts";
import type { FleetRecord } from "#model.ts";
import { codexServer, type WireRequest } from "#test/codex.ts";
import { authFolder, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { hostProcess } from "#test/hostProcess.ts";

export const configureCloud = Effect.fn("CloudHost.configureCloud")(function* (
	engine: HostStoryEngine,
	handle: (request: WireRequest) => unknown,
	cloud: Partial<HostConfig["cloud"]> = {},
) {
	const backend = yield* codexServer(handle);
	const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
	engine.config = {
		...engine.config,
		cloud: { authFile, cwd: SYNTHETIC_WORKSPACE, endpoint: backend.endpoint, environmentId: SYNTHETIC_ENVIRONMENT, ...cloud },
		provider: "cloud",
		worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" },
	};
});

export function cloudHostVerbs(engine: HostStoryEngine) {
	function runtime(noChange = false) {
		return hostLayer(engine.fixture.host, {
			...engine.fixture.parts,
			...(noChange ? { integrations: engineIntegrations({ noChange: true }, []) } : {}),
			provider: hostProvider(engine.fixture.host),
		});
	}
	return {
		awaitProcessRecord: (client: Effect.Success<ReturnType<typeof daemonClient>>, workId: string, ready: (record: FleetRecord) => boolean) => {
			let last: FleetRecord | undefined;
			return client("daemon.watch", { workIds: [workId] }).pipe(
				Stream.mapEffect(() => client("fleet.get", { workId }).pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined)))),
				Stream.filter((record): record is FleetRecord => record !== undefined),
				Stream.tap((record) =>
					Effect.sync(() => {
						last = record;
					}),
				),
				Stream.filter(ready),
				Stream.runHead,
				Effect.map(Option.getOrThrow),
				Effect.timeout("15 seconds"),
				Effect.mapError((cause) => new Error(`Process work did not settle: ${JSON.stringify(last)}`, { cause })),
			);
		},
		cloudReconcile: (workId: string, noChange = false) =>
			Effect.flatMap(Fleet, (fleet) => fleet.reconcile(workId)).pipe(Effect.provide(runtime(noChange))),
		cloudRecords: () => Effect.flatMap(Fleet, (fleet) => fleet.list()).pipe(Effect.provide(runtime())),
		processClient: (url: string | undefined) => {
			if (url === undefined) {
				throw new Error("Wait for the process listener before connecting");
			}
			return daemonClient(url);
		},
		renewCloudWork: (record: FleetRecord) =>
			Effect.flatMap(Fleet, (fleet) =>
				fleet.prepare({ cwd: record.cwd, preparation: record.preparation, prompt: record.prompt, workId: record.workId }),
			).pipe(Effect.provide(runtime()), Effect.result),
		spawnBoardProcess: () => hostProcess(engine.fixture.configFile, false, false, new URL("./boardProcess.ts", import.meta.url)),
		spawnHost: () => hostProcess(engine.fixture.configFile),
		spawnRestartHost: (pausePublication = false) => hostProcess(engine.fixture.configFile, pausePublication, true),
		useCloudProvider: () => {
			engine.parts = { ...engine.parts, provider: hostProvider(engine.fixture.host) };
		},
	};
}
