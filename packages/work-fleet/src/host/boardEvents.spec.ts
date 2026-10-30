import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";
import { readyScheduledHost } from "#test/scheduledHost.ts";

const slow = boardWork({}, { intervalSeconds: 3600 });

host.it(
	"an edited brief wakes admission before the slow pass",
	[boardWork({ "one.md": task("one", "held") }), slow, readyScheduledHost],
	function* (daemon) {
		const edited = task("one", "approved", "Use the edited brief.");
		daemon.writeBoard("one.md", edited);
		const record = yield* daemon.waitForRecord("one", (current) => current.step === "working").pipe(Effect.timeout("5 seconds"));
		expect(record.boardContext).toBe(edited);
		expect(record.attempts[0]?.prompt).toContain("Use the edited brief.");
	},
);

host.it(
	"an edited running brief reaches reconciliation through a change event",
	[boardWork({ "one.md": task("one", "approved") }), slow, readyScheduledHost],
	function* (daemon) {
		const started = yield* daemon.waitForRecord("one", (current) => current.step === "working");
		const edited = task("one", "approved", "Changed acceptance criteria.");
		daemon.writeBoard("one.md", edited);
		const steered = yield* daemon
			.waitForRecord("one", (current) => current.attempts[0]?.briefSteers?.[0]?.steeredAt !== undefined)
			.pipe(Effect.timeout("5 seconds"));
		expect(steered.boardContext).toBe(edited);
		expect(steered.attempts[0]?.receipt).toEqual(started.attempts[0]?.receipt);
		expect(daemon.providerSteers()).toMatchObject([{ prompt: expect.stringContaining("Changed acceptance criteria.") }]);
		expect(daemon.providerStarts().map(({ operationId }) => operationId)).toEqual(started.attempts.map(({ operationId }) => operationId));
	},
);

host.it("a new brief wakes admission before the slow pass", [slow, readyScheduledHost], function* (daemon) {
	daemon.writeBoard("new.md", task("new", "approved"));
	const record = yield* daemon.waitForRecord("new", (current) => current.step === "working").pipe(Effect.timeout("5 seconds"));
	expect(record.workId).toBe("new");
	expect(daemon.providerStarts().map(({ operationId }) => operationId)).toEqual(record.attempts.map(({ operationId }) => operationId));
});

host.it(
	"a Board answer wakes the scheduler before the slow pass",
	[boardWork({ "one.md": task("one", "approved") }), slow, readyScheduledHost],
	function* (daemon) {
		const started = yield* daemon.waitForRecord("one", (current) => current.step === "working");
		daemon.finishTurn(started, "FLEET_QUESTION: Which storage should I use?");
		const waiting = yield* daemon.reconcile("one");
		const published = waiting.decision?.published;
		if (published === undefined) {
			return yield* Effect.die("Expected a published worker question");
		}
		const board = yield* daemon.boardHttp();
		yield* daemon.publishAnswer(board, {
			author: "maintainer",
			body: "Use PostgreSQL.",
			id: "answer.storage",
			question: published.questionId,
			type: "answer",
		});
		const resumed = yield* daemon
			.waitForRecord("one", (record) => record.attempts.length > 1 && record.step === "working")
			.pipe(Effect.timeout("5 seconds"));
		expect(resumed.attempts.at(-1)?.prompt).toBe("Use PostgreSQL.");
		expect(resumed.responses).toMatchObject([{ action: "continue", responseId: "answer.storage" }]);
	},
);

host.it("the slow pass admits indexed work after its change event is missed", [], function* (daemon) {
	const safety = yield* daemon.startWithoutBoardEvents();
	daemon.writeBoard("missed.md", task("missed", "approved"));
	yield* safety.indexed("missed").pipe(Effect.timeout("5 seconds"));
	expect(daemon.providerStarts()).toHaveLength(0);
	yield* safety.elapse;
	const record = yield* daemon.waitForRecord("missed", (current) => current.step === "working");
	expect(record.workId).toBe("missed");
	expect(daemon.providerStarts().map(({ operationId }) => operationId)).toEqual(record.attempts.map(({ operationId }) => operationId));
});
