import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { followServer } from "#test/followServer.ts";

it.live("follow prints unfamiliar codes, stages and malformed entries beside known ones and continues", function* () {
	const server = yield* followServer();
	yield* withFollower("/synthetic/config.json", "watch", [], { follow: true, port: server.port }, (follower) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => server.subscribed);
			server.send([
				{ decision: { code: "future-decision", reason: "New decision" }, futureField: { value: true }, stage: "needs-human", workId: "new" },
				{ decision: { code: "worker-question", reason: "Known decision" }, stage: "needs-human", workId: "known" },
				{ futureField: true, stage: "future-stage", workId: "future" },
				{ decision: { reason: 42 }, stage: "needs-human", workId: "malformed" },
			]);
			yield* untilOutput(follower, "known needs-human (waiting on orchestrator): Known decision\n");
			yield* untilOutput(follower, "new needs-human (waiting on orchestrator): New decision: future-decision\n");
			yield* untilOutput(follower, "future future-stage\n");
			yield* untilOutput(follower, 'malformed needs-human: {"decision":{"reason":42},"stage":"needs-human","workId":"malformed"}\n');
			server.send([{ stage: "completed", workId: "later" }]);
			yield* untilOutput(follower, "later completed\n");
			expect(follower.isRunning()).toBe(true);
		}),
	);
});

it.live("a fatal follow error exits non-zero with one cause line", function* () {
	const server = yield* followServer();
	yield* withFollower("/synthetic/config.json", "watch", [], { follow: true, port: server.port }, (follower) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => server.subscribed);
			server.fail("Synthetic subscription failure\nInspect the daemon");
			expect(yield* Effect.promise(() => follower.done)).toEqual({
				code: 1,
				stderr: "work-fleet: Synthetic subscription failure Inspect the daemon",
				stdout: "",
			});
		}),
	);
});
