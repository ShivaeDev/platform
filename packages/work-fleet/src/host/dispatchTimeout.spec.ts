import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { waitForDispatch } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { refreshDelay } from "#test/refreshDelay.ts";

type Delay = Effect.Success<ReturnType<typeof refreshDelay>>;
const test = postgresTests("live");

const watchFailure = Effect.fn("DispatchTimeoutTest.watchFailure")(function* (
	fixture: HostFixture,
	port: number,
	delay: Delay,
	snapshot: Promise<void>,
) {
	yield* withFollower(fixture.configFile, "watch", [], { interval: 0.1, port }, (follower) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => snapshot);
			expect(follower.isRunning()).toBe(true);
			expect(follower.output()).toBe("");
			yield* delay.release;
			expect(yield* Effect.promise(() => follower.done)).toMatchObject({
				code: 0,
				stdout: expect.stringContaining("Dispatch failed: Git refresh unavailable"),
			});
		}),
	);
});

const refreshRequest = Effect.fn("DispatchTimeoutTest.refreshRequest")(function* (
	fixture: HostFixture,
	port: number,
	delay: Delay,
	fail: boolean,
	snapshot: Promise<void>,
) {
	yield* Effect.addFinalizer(() => delay.release);
	const client = yield* daemonClient(port);
	const cli = yield* Effect.promise(() => cliProcess(["dispatch", "one", "--port", String(port)])).pipe(Effect.timeout("3 seconds"));
	expect(cli).toEqual({ code: 0, stdout: "one: dispatch recorded; preparing and launching in the background" });
	yield* delay.entered;
	const accepted = yield* client("daemon.dispatch-status", { workId: "one" });
	expect(accepted).toMatchObject({ status: "pending", workId: "one" });
	expect(yield* client("daemon.dispatch", { workId: "one" })).toEqual(accepted);
	expect((yield* client("fleet.get", { workId: "one" }).pipe(Effect.flip))._tag).toBe("NotFound");
	expect(fixture.provider.launched).toHaveLength(0);
	const status = yield* Effect.promise(() => cliProcess(["status", "one", "--port", String(port)]));
	expect(status.stdout).toContain("one  dispatch pending");
	yield* fail ? watchFailure(fixture, port, delay, snapshot) : delay.release;
	const outcome = yield* waitForDispatch(client, "one");
	expect(outcome).toMatchObject({ id: accepted?.id, status: fail ? "failed" : "completed" });
	if (fail) {
		expect(outcome.error).toBe("Git refresh unavailable");
		const failed = yield* Effect.promise(() => cliProcess(["status", "one", "--port", String(port)]));
		expect(failed.stdout).toContain("one  dispatch failed: Git refresh unavailable");
	} else {
		expect((yield* client("fleet.get", { workId: "one" })).stage).toBe("executing");
		expect(fixture.provider.launched).toHaveLength(1);
	}
});

const refreshStory = Effect.fn("DispatchTimeoutTest.refreshStory")(function* (fixture: HostFixture, fail: boolean) {
	const delay = yield* refreshDelay(fixture, fail);
	const snapshot = Promise.withResolvers<void>();
	return yield* withReadDaemon(fixture.host, (port) => refreshRequest(fixture, port, delay, fail, snapshot.promise), {
		onSnapshot: () => snapshot.resolve(),
		parts: delay.parts,
	});
});

for (const fail of [false, true]) {
	test(`CLI dispatch records acceptance before a blocked first main refresh, failure=${fail}`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) => refreshStory(fixture, fail)));
}
