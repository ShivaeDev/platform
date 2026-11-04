import { Effect } from "effect";
import type { DatabaseEngine } from "./databaseEngine.ts";

export function wakeWorkers(engine: DatabaseEngine, queue?: string) {
	for (const [name, runtime] of engine.runtimes) {
		for (const worker of runtime.client.getWipData?.() ?? []) {
			if (queue === undefined || worker.name === queue) {
				engine.pollers.get(name)?.(worker.id);
			}
		}
	}
}

export function driveWorkers<A, E, R>(engine: DatabaseEngine, wait: Effect.Effect<A, E, R>) {
	function poll() {
		wakeWorkers(engine);
	}
	return Effect.acquireUseRelease(
		Effect.sync(() => {
			engine.work.changed.add(poll);
			poll();
		}),
		() => wait,
		() => Effect.sync(() => engine.work.changed.delete(poll)),
	);
}
