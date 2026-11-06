import { setImmediate } from "node:timers/promises";
import { Effect } from "effect";
import { storyKit } from "#server/storyKit.ts";

export const snapshotMemory = storyKit({
	create: () => ({}),
	name: "snapshot memory",
	stages: [],
	verbs: (_engine, story) => ({
		collectGarbage: () =>
			Effect.promise(async () => {
				await setImmediate();
				if (globalThis.gc === undefined) {
					throw new Error("Run snapshot memory stories with --expose-gc.");
				}
				await globalThis.gc({ execution: "async", type: "major" });
			}),
		fail: () => Effect.fail("the snapshot is unavailable"),
		releaseSnapshot: () => {
			const snapshot = new Uint8Array(16 * 1024 * 1024);
			function tellRead() {
				story.tell(`read a ${snapshot.byteLength} byte snapshot`);
			}
			tellRead();
			return new WeakRef(snapshot);
		},
	}),
});
