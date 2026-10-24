import { Effect } from "effect";
import { cloudFanout } from "#test/cloudFanout.ts";
import { configureCloud } from "#test/cloudHost.ts";
import { task } from "#test/fleetHost.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

const backends = new WeakMap<HostStoryEngine, ReturnType<typeof cloudFanout>>();
export function configureFanoutCloud(engine: HostStoryEngine, count: number) {
	engine.externalProcess = true;
	engine.files = Object.fromEntries(Array.from({ length: count }, (_, index) => [`work-${index}.md`, task(`synthetic-work-${index}`, "approved")]));
	engine.config = { ...engine.config, readRetryMs: 1000 };
	engine.beforeFixture = Effect.gen(function* () {
		const backend = cloudFanout();
		backends.set(engine, backend);
		yield* configureCloud(engine, backend.handle, { requestTimeoutMs: 1000 });
	});
}

export function fanoutCloudVerbs(engine: HostStoryEngine) {
	return {
		cloudFanout: () => {
			const backend = backends.get(engine);
			if (backend === undefined) {
				throw new Error("Configure Cloud fanout first");
			}
			return { mutations: backend.mutations, operations: backend.operations, sessions: backend.sessions };
		},
	};
}
