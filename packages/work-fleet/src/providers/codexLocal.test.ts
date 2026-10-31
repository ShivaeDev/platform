import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { providerStory } from "#test/providerStory.ts";
import { byCursor, page, turn } from "#test/wireScript.ts";

const RECEIPT = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
const WORK = { cwd: "/synthetic", operationId: "operation", prompt: "work" };
const COMPLETED = {
	"thread/items/list": page([{ item: { id: "message", text: "Evidence", type: "agentMessage" } }]),
	"thread/start": { thread: { id: RECEIPT.sessionId } },
	"thread/turns/list": page([turn(RECEIPT.turnId, "completed")]),
	"turn/start": { turn: { id: RECEIPT.turnId } },
};
const RUNNING = { "thread/items/list": page([]), "thread/turns/list": page([turn(RECEIPT.turnId, "inProgress")]) };

providerStory.it("a local session and its turn take the ids Codex acknowledges", [], function* ({ answers, provider }) {
	yield* answers(COMPLETED);
	expect(yield* provider.openSession(WORK)).toBe(`session ${RECEIPT.sessionId}`);

	const outcome = yield* provider.submit({ ...WORK, sessionId: RECEIPT.sessionId });

	expect(outcome).toBe("turn synthetic-turn on synthetic-session");
});

providerStory.it("a completed turn's evidence is read once and served from cache afterwards", [], function* ({ answers, methods, provider }) {
	yield* answers(COMPLETED);
	expect((yield* provider.observe(RECEIPT)).output).toBe("Evidence");

	const again = yield* provider.observe(RECEIPT);

	expect(again.output).toBe("Evidence");
	expect(yield* methods("thread/turns/list", "thread/items/list")).toEqual(["thread/turns/list", "thread/items/list"]);
});

providerStory.it(
	"closing the provider observer does not interrupt the observed running turn",
	[],
	function* ({ answers, closeObserver, methods, provider }) {
		yield* answers(RUNNING);
		yield* provider.observe(RECEIPT);

		yield* closeObserver();

		expect(yield* methods("turn/interrupt")).toEqual([]);
	},
);

providerStory.it(
	"recovery reads every page of turns and fails as ambiguous when the operation appears twice",
	[],
	function* ({ answers, methods, provider }) {
		yield* answers({
			"thread/turns/list": byCursor({
				first: page([turn("first-turn", "completed", "operation")], "second"),
				second: page([turn("second-turn", "completed", "operation")]),
			}),
		});

		const outcome = yield* provider.recover({ operationId: "operation", sessionId: RECEIPT.sessionId });

		expect(outcome).toMatch(/^session ambiguous/u);
		expect(yield* methods("thread/turns/list", "turn/start")).toEqual(["thread/turns/list", "thread/turns/list"]);
	},
);

providerStory.it(
	"recovery after a restart adopts the acknowledged running turn without resubmitting it",
	[],
	function* ({ answers, methods, provider }) {
		yield* answers(RUNNING);

		const outcome = yield* provider.recover({ operationId: "operation", ...RECEIPT });

		expect(outcome).toBe("turn synthetic-turn on synthetic-session");
		yield* outcomes([
			["execution", () => provider.observe(RECEIPT).pipe(Effect.map(({ execution }) => execution)), "running"],
			["submitted turns", () => methods("turn/start"), []],
		]);
	},
);

providerStory.it("interrupting a turn sends one interrupt and confirms it with the turn's receipt", [], function* ({ answers, methods, provider }) {
	yield* answers(RUNNING);

	const outcome = yield* provider.interrupt(RECEIPT);

	expect(outcome).toBe("interrupted turn synthetic-turn on synthetic-session");
	expect(yield* methods("turn/interrupt")).toEqual(["turn/interrupt"]);
});

providerStory.it(
	"a turn whose acknowledgement is lost is found by recovery without a second submission",
	[],
	function* ({ answers, methods, provider }) {
		yield* answers({
			"thread/start": { thread: { id: RECEIPT.sessionId } },
			"thread/turns/list": page([turn(RECEIPT.turnId, "inProgress", "operation")]),
			"turn/start": undefined,
		});
		expect(yield* provider.submit({ ...WORK, sessionId: RECEIPT.sessionId })).toMatch(/^session ambiguous/u);

		const outcome = yield* provider.recover({ operationId: "operation", sessionId: RECEIPT.sessionId });

		expect(outcome).toBe("turn synthetic-turn on synthetic-session");
		expect(yield* methods("turn/start")).toEqual(["turn/start"]);
	},
);
