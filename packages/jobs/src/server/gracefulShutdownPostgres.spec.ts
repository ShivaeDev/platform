import { expect } from "vitest";
import { postgresIt, realPostgres } from "#test/boss.ts";

for (const shared of [false, true]) {
	postgresIt(
		`drains a handler before releasing ${shared ? "a shared" : "its own"} client under parallel Layer finalization`,
		[realPostgres],
		function* ({ gracefulShutdown }) {
			const worker = yield* gracefulShutdown(shared);
			yield* worker.send("held-job");
			yield* worker.active;

			const stopped = yield* worker.stop;

			expect(worker.events).toEqual([]);
			yield* worker.release;
			yield* stopped;
			expect(worker.events).toEqual(["held-job"]);
		},
	);
}
