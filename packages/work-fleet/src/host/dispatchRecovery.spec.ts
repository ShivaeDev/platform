import { expect } from "@effect/vitest";
import { Effect, Stream } from "effect";
import type { DispatchRequest } from "#DispatchRequest.ts";
import { hostScheduler } from "#host/commands.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { waitForDispatch, waitForRecord } from "#test/daemonActions.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { refreshDelay } from "#test/refreshDelay.ts";

type Delay = Effect.Success<ReturnType<typeof refreshDelay>>;

const acceptBeforeRestart = Effect.fn("DispatchRecoveryTest.acceptBeforeRestart")(function* (
	port: number,
	delay: Delay,
	fail: boolean,
	now: boolean,
) {
	const client = yield* daemonClient(port);
	const request = yield* client("daemon.dispatch", { now, workId: "one" });
	expect(request.now).toBe(now ? true : undefined);
	yield* delay.entered;
	if (fail) {
		yield* delay.release;
		const failed = yield* waitForDispatch(client, "one");
		expect(failed.status).toBe("failed");
		return failed;
	}
	return request;
});

const finishAfterRestart = Effect.fn("DispatchRecoveryTest.finishAfterRestart")(function* (
	fixture: HostFixture,
	port: number,
	accepted: DispatchRequest,
	fail: boolean,
) {
	const client = yield* daemonClient(port);
	const request = fail ? yield* client("daemon.dispatch", { workId: "one" }) : accepted;
	if (fail) {
		expect(request.id).not.toBe(accepted.id);
	}
	expect(yield* waitForDispatch(client, "one")).toMatchObject({ id: request.id, status: "completed" });
	const record = yield* client("fleet.get", { workId: "one" });
	expect(record.stage).toBe("executing");
	expect(record.dispatchNow).toEqual(accepted.now === true ? { ignoreAreas: false } : undefined);
	expect(fixture.provider.launched).toHaveLength(1);
});

const restartStory = Effect.fn("DispatchRecoveryTest.restartStory")(function* (fixture: HostFixture, fail: boolean, now = false) {
	const delay = yield* refreshDelay(fixture, fail);
	const accepted = yield* withReadDaemon(fixture.host, (port) => acceptBeforeRestart(port, delay, fail, now), delay.parts);
	expect(fixture.provider.launched).toHaveLength(0);
	yield* withReadDaemon(fixture.host, (port) => finishAfterRestart(fixture, port, accepted, fail), fixture.parts);
});

for (const fail of [false, true]) {
	postgresTests("live")(`dispatch ${fail ? "can be retried after refresh failure" : "resumes its pending receipt after daemon restart"}`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) => restartStory(fixture, fail)),
	);
}

postgresTests("live")("dispatch now resumes its pending receipt with the override after daemon restart", () =>
	withHost({ "one.md": task("one", "approved") }, {}, (fixture) => restartStory(fixture, false, true)),
);

const schedulerRecovery = Effect.fn("DispatchRecoveryTest.schedulerRecovery")(function* (
	fixture: HostFixture,
	port: number,
	failed: DispatchRequest,
) {
	const client = yield* daemonClient(port);
	yield* hostScheduler(fixture.host).pipe(Effect.forkScoped);
	yield* waitForRecord(client, "one", (record) => record.stage === "executing" && record.attempts.at(-1)?.status === "running");
	const executing = yield* client("daemon.follow", { workIds: ["one"] }).pipe(Stream.take(1), Stream.runCollect);
	const watched = yield* withFollower(fixture.configFile, "watch", ["one"], { port }, (follower) =>
		Effect.gen(function* () {
			for (const [id, observation] of fixture.provider.observations) {
				fixture.provider.observations.set(id, { ...observation, execution: "completed", output: "Recovered findings." });
			}
			const completed = yield* waitForRecord(client, "one", (record) => record.stage === "completed");
			expect(completed.report?.sourcePath).toBeDefined();
			return yield* Effect.promise(() => follower.done);
		}),
	);
	const completed = yield* client("daemon.follow", { workIds: ["one"] }).pipe(Stream.take(1), Stream.runCollect);
	expect(executing).toMatchObject([[{ stage: "executing", workId: "one" }]]);
	expect(completed).toMatchObject([[{ stage: "completed", workId: "one" }]]);
	expect(watched).toMatchObject({ code: 0, stderr: "", stdout: expect.stringContaining("one completed") });
	expect(watched.stdout).not.toContain("Dispatch failed");
	expect(yield* client("daemon.dispatch-status", { workId: "one" })).toEqual(failed);
	expect(fixture.provider.launched).toHaveLength(1);
});

const schedulerStory = Effect.fn("DispatchRecoveryTest.schedulerStory")(function* (fixture: HostFixture) {
	const delay = yield* refreshDelay(fixture, true);
	const failed = yield* withReadDaemon(fixture.host, (port) => acceptBeforeRestart(port, delay, true, false), delay.parts);
	yield* withReadDaemon(fixture.host, (port) => schedulerRecovery(fixture, port, failed), fixture.parts);
});

postgresTests("live")("watch preserves scheduler recovery and completion after a failed dispatch without another dispatch", () =>
	withHost({ "one.md": task("one", "approved").replace("fleet: approved", "fleet: approved\nfleet-deliverable: report") }, {}, schedulerStory),
);
