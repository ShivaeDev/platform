import { expect } from "@effect/vitest";
import { prWatchClock } from "#test/prWatchClock.ts";

prWatchClock.it("the combined PR engine stays silent beyond pr-watch's routine heartbeat period", [], function* (watch) {
	yield* watch.start();
	yield* watch.awaitPoll();
	for (let minute = 0; minute < 16; minute += 1) {
		yield* watch.advance(60_000);
		yield* watch.awaitPoll();
	}
	expect(watch.lines()).toEqual([]);
	watch.conflict();
	yield* watch.advance(60_000);
	yield* watch.awaitPoll();
	expect(watch.lines()).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "pr-conflict" })]));
});
