import { expect } from "@effect/vitest";
import { Effect } from "effect";
import type { DispatchRequest } from "#DispatchRequest.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { waitForDispatch } from "#test/daemonActions.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { refreshDelay } from "#test/refreshDelay.ts";

type Delay = Effect.Success<ReturnType<typeof refreshDelay>>;

const acceptBeforeRestart = Effect.fn("DispatchRecoveryTest.acceptBeforeRestart")(function* (port: number, delay: Delay, fail: boolean) {
	const client = yield* daemonClient(port);
	const request = yield* client("daemon.dispatch", { workId: "one" });
	yield* delay.entered;
	if (fail) {
		yield* delay.release;
		expect((yield* waitForDispatch(client, "one")).status).toBe("failed");
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
	expect((yield* client("fleet.get", { workId: "one" })).stage).toBe("executing");
	expect(fixture.provider.launched).toHaveLength(1);
});

const restartStory = Effect.fn("DispatchRecoveryTest.restartStory")(function* (fixture: HostFixture, fail: boolean) {
	const delay = yield* refreshDelay(fixture, fail);
	const accepted = yield* withReadDaemon(fixture.host, (port) => acceptBeforeRestart(port, delay, fail), delay.parts);
	expect(fixture.provider.launched).toHaveLength(0);
	yield* withReadDaemon(fixture.host, (port) => finishAfterRestart(fixture, port, accepted, fail), fixture.parts);
});

for (const fail of [false, true]) {
	postgresTests("live")(`dispatch ${fail ? "can be retried after refresh failure" : "resumes its pending receipt after daemon restart"}`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) => restartStory(fixture, fail)),
	);
}
