import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sessionStory, transportDoes } from "#test/sessionStory.ts";

sessionStory.it("archiving through a transport without archive support succeeds without a provider call", [], function* ({ archive, events }) {
	const outcome = yield* archive();

	expect(outcome).toBe("archived");
	expect(yield* events()).toEqual([]);
});

sessionStory.it("starting a session persists each acknowledgement before the next provider mutation", [], function* ({ commands, events }) {
	const outcome = yield* commands.start();

	expect(outcome).toBe("started turn synthetic-turn on synthetic-session");
	expect(yield* events()).toEqual(["session acknowledged", "session persisted", "turn submitted:synthetic-session", "turn persisted"]);
});

sessionStory.it("observing a turn reports provisioning separately from execution", [], function* ({ commands }) {
	const outcome = yield* commands.observe();

	expect(outcome).toBe("execution accepted, provisioning unknown");
});

sessionStory.it(
	"a session whose journal write fails is refused for persistence and never submits a turn",
	[transportDoes({ brokenJournal: true })],
	function* ({ commands, events }) {
		const outcome = yield* commands.start();

		expect(outcome).toBe("session persistence: unavailable");
		expect(yield* events()).toEqual(["session acknowledged", "session persisted"]);
	},
);

sessionStory.it(
	"reconciling a turn whose acceptance was lost persists it without submitting it again",
	[transportDoes({ lostTurn: true })],
	function* ({ commands, events }) {
		yield* outcomes([
			["start", () => commands.start(), "session ambiguous: lost reply"],
			["provider and journal events", () => events(), ["session acknowledged", "session persisted", "turn submitted:synthetic-session"]],
		]);

		const outcome = yield* commands.reconcile();

		expect(outcome).toBe("reconciled turn synthetic-turn on synthetic-session");
		expect(yield* events()).toEqual([
			"session acknowledged",
			"session persisted",
			"turn submitted:synthetic-session",
			"existing operation reconciled",
			"turn persisted",
		]);
	},
);

sessionStory.it("continuing the acknowledged session submits and persists a turn without interrupting it", [], function* ({ commands, events }) {
	const outcome = yield* commands.continue();

	expect(outcome).toBe("continued turn synthetic-turn on synthetic-session");
	expect(yield* events()).toEqual(["session persisted", "turn submitted:synthetic-session", "turn persisted"]);
});

sessionStory.it("an explicit interrupt is acknowledged by the provider", [], function* ({ commands, events }) {
	const outcome = yield* commands.interrupt();

	expect(outcome).toBe("interrupted turn synthetic-turn on synthetic-session");
	expect(yield* events()).toEqual(["explicit interruption acknowledged"]);
});

for (const command of ["start", "continue", "reconcile", "observe", "interrupt"] as const) {
	sessionStory.it(
		`${command} refuses a foreign provider receipt as ambiguous before the journal persists a turn`,
		[transportDoes({ differentReceipt: true })],
		function* ({ commands, events }) {
			const outcome = yield* commands[command]();

			expect(outcome).toBe("session ambiguous: Provider receipt differs from the persisted session or turn; retain reservation");
			expect(yield* events()).not.toContain("turn persisted");
		},
	);
}

sessionStory.it(
	"an interrupt whose acknowledgement is lost stays ambiguous instead of claiming the interruption",
	[transportDoes({ interruptFailure: true })],
	function* ({ commands, events }) {
		const outcome = yield* commands.interrupt();

		expect(outcome).toBe("session ambiguous: No interruption acknowledgement");
		expect(yield* events()).not.toContain("explicit interruption acknowledged");
	},
);
