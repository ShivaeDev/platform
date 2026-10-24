import { Effect, Layer } from "effect";
import { fleetSessionJournal, postgresFleetRepository } from "#engine/repository.ts";
import { hostProvider } from "#host/providers.ts";
import { hostSql } from "#host/runtime.ts";
import type { FleetRecord } from "#model.ts";
import { SessionService } from "#session/service.ts";
import { configureCloud } from "#test/cloudHost.ts";
import { task } from "#test/fleetHost.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { namingBackend } from "#test/namedCloudHost.ts";

const states = new WeakMap<HostStoryEngine, ReturnType<typeof namingBackend>>();
export function configureCloudNaming(engine: HostStoryEngine, prefix?: string) {
	engine.files = { "work.md": task("synthetic-work", "approved", "Synthetic body").replace("# synthetic-work", "# Readable title") };
	engine.beforeFixture = Effect.gen(function* () {
		const backend = namingBackend();
		states.set(engine, backend);
		yield* configureCloud(engine, backend.handle, prefix === undefined ? {} : { threadNamePrefix: prefix });
	});
	engine.beforeStart = Effect.sync(() => {
		engine.parts = { ...engine.parts, provider: hostProvider(engine.fixture.host) };
	});
}
export function cloudNamingVerbs(engine: HostStoryEngine) {
	function state() {
		const value = states.get(engine);
		if (value === undefined) {
			throw new Error("Configure Cloud naming first");
		}
		return value;
	}
	function sessionLayer() {
		const repository = postgresFleetRepository(engine.fixture.host.namespace).pipe(Layer.provide(hostSql(engine.fixture.host)));
		return SessionService.layer.pipe(Layer.provide([fleetSessionJournal.pipe(Layer.provide(repository)), hostProvider(engine.fixture.host)]));
	}
	return {
		allowNaming: () => state().failures.clear(),
		continueNamedSession: (operationId: string, prompt: string, sessionId: string) =>
			Effect.flatMap(SessionService, (sessions) => sessions.continue({ operationId, prompt, sessionId })).pipe(Effect.provide(sessionLayer())),
		failNaming: (method: string, sessionId: string) => state().failures.add(`${method}:${sessionId}`),
		names: () => [...state().names.values()],
		namingRequests: () => state().requests,
		setThreadName: (sessionId: string, name: string) => state().names.set(sessionId, name),
		startNamedSession: (operationId: string, prompt: string) =>
			Effect.flatMap(SessionService, (sessions) => sessions.start({ cwd: engine.fixture.host.cloud?.cwd ?? "", operationId, prompt })).pipe(
				Effect.provide(sessionLayer()),
			),
		storeNamingRecord: (record: FleetRecord) => engine.store(record.workId, record),
	};
}
