import { Effect } from "effect";
import { configureCloud } from "#test/cloudHost.ts";
import { type Boundary, restartBackend } from "#test/cloudRestart.ts";
import { task } from "#test/fleetHost.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { retryInterrupted } from "#test/retryInterrupted.ts";

const backends = new WeakMap<HostStoryEngine, ReturnType<typeof restartBackend>>();
export function configureInterruptedCloud(engine: HostStoryEngine, boundary: Boundary) {
	engine.externalProcess = true;
	engine.files = { "work.md": task("synthetic-work", "approved") };
	engine.beforeFixture = Effect.gen(function* () {
		const backend = restartBackend(boundary);
		backends.set(engine, backend);
		yield* configureCloud(engine, backend.handle, { recoveryGraceMs: 1000, requestTimeoutMs: 60_000 });
	});
}

export function interruptedCloudVerbs(engine: HostStoryEngine) {
	function backend() {
		const value = backends.get(engine);
		if (value === undefined) {
			throw new Error("Configure an interrupted Cloud launch first");
		}
		return value;
	}
	return {
		allowCloudRetry: () => backend().allowRetry(),
		cloudBoundaryReached: () => backend().reached,
		cloudLaunches: () => ({ requests: backend().requests, sessions: backend().sessions, turns: backend().turns }),
		retryInterrupted: () => retryInterrupted(engine.fixture),
	};
}
