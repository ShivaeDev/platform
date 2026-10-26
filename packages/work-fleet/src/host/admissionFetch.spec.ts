import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { fetchingMain } from "#test/fetchingMain.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it("admission serializes its fetch with another daemon read of main", [approvedWork(["one"]), fetchingMain], function* (daemon) {
	daemon.holdMainFetch();
	const reading = yield* daemon.fetchLatestMain().pipe(Effect.forkChild);
	yield* daemon.awaitMainFetch();
	const admission = yield* daemon.admit().pipe(Effect.forkChild);
	yield* Effect.sleep("250 millis");
	yield* daemon.externalMainFetch();
	daemon.releaseMainFetch();
	expect(yield* Fiber.join(reading)).toMatchObject({ revision: daemon.pushedMainRevision() });
	expect(yield* Fiber.join(admission)).toEqual([]);
	expect(daemon.mainFetchesOverlapped()).toBe(false);
	expect(yield* daemon.get("one")).toMatchObject({ preparation: { baseRevision: daemon.pushedMainRevision() }, step: "queued" });
});

host.it("admission retries when an external fetch advances its expected main ref", [approvedWork(["one"]), fetchingMain], function* (daemon) {
	daemon.holdMainFetch();
	const admission = yield* daemon.admit().pipe(Effect.forkChild);
	yield* daemon.awaitMainFetch();
	yield* daemon.externalMainFetch();
	daemon.releaseMainFetch();
	expect(yield* Fiber.join(admission)).toEqual([]);
	expect(yield* daemon.get("one")).toMatchObject({ preparation: { baseRevision: daemon.pushedMainRevision() }, step: "queued" });
});

host.it("admission reports a real unreachable Git remote", [approvedWork(["one"]), fetchingMain], function* (daemon) {
	daemon.breakMainRemote();
	const failure = yield* daemon.admit().pipe(Effect.flip);
	expect(failure).toMatchObject({ _tag: "ServiceUnavailable" });
	expect(failure.message).toContain("git fetch failed: Command failed: git fetch --quiet origin main");
	expect(failure.message).toContain("unreachable.git");
	expect(failure.message).toContain("does not appear to be a git repository");
});
