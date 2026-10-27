import { Effect } from "effect";
import type { Job } from "pg-boss";
import type { FakeClient } from "#test/fakeClient.ts";

export function dispatch(client: FakeClient, name: string, jobs: readonly Job<unknown>[]) {
	return Effect.promise(() => {
		const worker = client.workers.find((entry) => entry.name === name);
		if (worker === undefined) {
			throw new Error(`No worker registered for ${name}`);
		}
		return worker.run(jobs);
	});
}
