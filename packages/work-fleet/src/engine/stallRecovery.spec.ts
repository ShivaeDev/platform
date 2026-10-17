import { expect } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { TestClock } from "effect/testing";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration } from "#test/codex.ts";
import { type EngineFixture, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { stalledCodex } from "#test/stalledCodex.ts";

for (const delayInterrupt of [false, true]) {
	postgresTests("test", "isolated")(
		`stalled turns steer once, interrupt and retry the same thread, then ask the orchestrator: delayed=${delayInterrupt}`,
		function* () {
			const server = yield* stalledCodex(delayInterrupt);
			const clock = yield* Clock.Clock;
			yield* Effect.gen(function* () {
				const transport = yield* SessionTransport;
				yield* withEngine({ decorateTransport: () => transport, now: () => clock.currentTimeMillisUnsafe() }, (fixture) =>
					recoveryStory(fixture, server, delayInterrupt),
				);
			}).pipe(Effect.provide(codexConfiguration(server.endpoint)));
		},
	);
}

const recoveryStory = Effect.fnUntraced(function* (
	fixture: EngineFixture,
	server: Effect.Success<ReturnType<typeof stalledCodex>>,
	delayInterrupt: boolean,
) {
	const fleet = yield* Fleet;
	yield* prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.reconcile("one");
	yield* TestClock.adjust("31 minutes");
	const steered = yield* fleet.reconcile("one");
	expect(server.requests.filter((request) => request.method === "turn/steer")).toEqual([
		expect.objectContaining({
			params: {
				expectedTurnId: "turn-1",
				input: [{ text: expect.stringContaining("Continue the approved work"), "text_elements": [], type: "text" }],
				threadId: "worker-thread",
			},
		}),
	]);
	expect(steered.value.attempts[0]?.progress?.at).toBe(0);
	expect(renderStatus(views([steered.value]))).toContain("last progress 1970-01-01T00:00:00.000Z; Fleet steer requested 1970-01-01T00:31:00.000Z");
	yield* fixture.restart(fleet.reconcile("one"));
	expect(server.requests.filter((request) => request.method === "turn/steer")).toHaveLength(1);
	yield* TestClock.adjust("30 minutes");
	let retried = yield* fleet.reconcile("one");
	if (delayInterrupt) {
		expect(retried.value.attempts).toHaveLength(1);
		yield* fixture.restart(fleet.reconcile("one"));
		server.states.set("turn-1", "interrupted");
		retried = yield* fixture.restart(fleet.reconcile("one"));
	}
	expect(retried.value.attempts.map((attempt) => attempt.receipt)).toEqual([
		{ sessionId: "worker-thread", turnId: "turn-1" },
		{ sessionId: "worker-thread", turnId: "turn-2" },
	]);
	expect(server.requests.filter((request) => request.method === "turn/interrupt")).toEqual([
		expect.objectContaining({ params: { threadId: "worker-thread", turnId: "turn-1" } }),
	]);
	expect(server.requests.filter((request) => request.method === "turn/start").at(-1)?.params).toMatchObject({
		input: [{ text: expect.stringContaining("Continue on the same branch and PR") }],
		threadId: "worker-thread",
	});
	expect(server.requests.filter((request) => request.method === "thread/start")).toHaveLength(1);
	expect(statusMarkdown([retried.value])).toContain("Fleet interrupt acknowledged 1970-01-01T01:01:00.000Z");
	yield* fleet.reconcile("one");
	yield* TestClock.adjust("31 minutes");
	const exhausted = yield* fleet.reconcile("one");
	expect(exhausted.value).toMatchObject({
		attentionOwner: "orchestrator",
		decision: { code: "session-stalled" },
		decisionPublished: true,
		stage: "needs-human",
	});
	expect(fixture.decisions).toHaveLength(1);
	expect(server.requests.filter((request) => request.method === "turn/steer")).toHaveLength(1);
});
