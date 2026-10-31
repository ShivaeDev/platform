import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { launchAcknowledgement } from "#test/launchAcknowledgement.ts";

const BOTH_DISPATCHED = ["dispatched one", "dispatched two"];

isolatedEngine.it(
	"a slow thread acknowledgement lets the pass dispatch the next work and is persisted after the pass without a recovery decision",
	[engineConfiguration("the slow launch acknowledgement arrives after its pass", launchAcknowledgement("slow"))],
	function* ({
		fleet,
		launches,
		operationReceipt,
		prepareWork,
		publishedDecisions,
		releaseTimingGate,
		schedule,
		scheduleWithLateAcknowledgement,
		waitForStoredRecord,
	}) {
		yield* prepareWork("one");
		yield* prepareWork("two");

		const dispatched = yield* scheduleWithLateAcknowledgement();

		expect(dispatched).toEqual(BOTH_DISPATCHED);
		yield* schedule();
		expect(publishedDecisions()).toEqual([]);
		yield* releaseTimingGate("acknowledgement");
		yield* waitForStoredRecord("one", (record) => record.attempts[0]?.receipt !== undefined);
		expect((yield* fleet.get("one")).value.attempts[0]?.receipt).toEqual(operationReceipt("operation-1"));
		expect(launches()).toEqual(["operation-1", "operation-2"]);
	},
);

for (const acknowledgement of ["session", "turn"] as const) {
	isolatedEngine.it(
		`a lost ${acknowledgement} acknowledgement lets the pass dispatch the next work and keeps the first launch executing across a restart without relaunching it`,
		[engineConfiguration(`the ${acknowledgement} launch acknowledgement arrives after its pass`, launchAcknowledgement(acknowledgement))],
		function* ({
			executionOf,
			firstAttemptOf,
			fleet,
			get,
			launches,
			operationReceipt,
			prepareWork,
			publishedDecisions,
			restart,
			schedule,
			scheduleWithLateAcknowledgement,
		}) {
			yield* prepareWork("one");
			yield* prepareWork("two");

			const dispatched = yield* scheduleWithLateAcknowledgement();

			expect(dispatched).toEqual(BOTH_DISPATCHED);
			yield* outcomes([
				["first attempt of one", () => firstAttemptOf("one"), { operationId: "operation-1", receipt: "no receipt", status: "submitting" }],
				["one", () => executionOf("one"), "executing"],
				["two", () => get("two"), { value: { attempts: [{ receipt: expect.anything() }] } }],
			]);
			expect(publishedDecisions()).toEqual([]);
			yield* restart();
			yield* schedule();
			const recovered =
				acknowledgement === "turn"
					? { operationId: "operation-1", receipt: operationReceipt("operation-1"), status: "running" as const }
					: { operationId: "operation-1" };
			yield* outcomes([
				["one", () => fleet.get("one"), { value: { attempts: [recovered] } }],
				["one execution", () => executionOf("one"), "executing"],
			]);
			expect(launches()).toEqual(["operation-1", "operation-2"]);
		},
	);
}

isolatedEngine.it(
	"an explicit capacity rejection after a lost acknowledgement schedules a launch retry and stops the rest of the pass",
	[engineConfiguration("the capacity launch acknowledgement arrives after its pass", launchAcknowledgement("capacity"))],
	function* ({ attemptsOf, get, launches, prepareWork, scheduleWithLateAcknowledgement, setDependencies }) {
		setDependencies("dependent", []);
		for (const id of ["one", "two", "dependent"]) {
			yield* prepareWork(id);
		}

		const dispatched = yield* scheduleWithLateAcknowledgement();

		expect(dispatched).toEqual(BOTH_DISPATCHED);
		yield* outcomes([
			["two", () => get("two"), { value: { launchRetry: expect.anything() } }],
			["attempts on dependent", () => attemptsOf("dependent"), 0],
		]);
		expect(launches()).toEqual(["operation-1", "operation-2"]);
	},
);

isolatedEngine.it(
	"a capacity rejection from a background launch stops later dispatch",
	[engineConfiguration("the background launch acknowledgement arrives after its pass", launchAcknowledgement("background"))],
	function* ({ attemptsOf, launches, prepareWork, scheduleWithBackgroundRejection, setDependencies }) {
		setDependencies("dependent", []);
		for (const id of ["one", "two", "dependent"]) {
			yield* prepareWork(id);
		}

		const dispatched = yield* scheduleWithBackgroundRejection();

		expect(dispatched).toEqual(BOTH_DISPATCHED);
		expect(yield* attemptsOf("dependent")).toBe(0);
		expect(launches()).toEqual(["operation-1", "operation-2"]);
	},
);

isolatedEngine.it(
	"a human retry after a rejected first turn reuses its thread for the next turn without a new launch",
	[],
	function* ({ fleet, launches, prepareWork, rejectNextTurn, respond, restart, schedule }) {
		yield* prepareWork("one");
		rejectNextTurn();
		const rejected = (yield* fleet.dispatch("one")).value;
		const decisionId = rejected.decision?.id ?? "missing";

		yield* fleet.resolve("one", decisionId, respond(decisionId, "retry"));

		yield* restart();
		yield* schedule();
		const accepted = (yield* fleet.get("one")).value;
		expect(accepted.attempts.map(({ operationId }) => operationId)).toEqual(["operation-1", "operation-2"]);
		expect(accepted.attempts.at(-1)?.receipt).toEqual({ sessionId: rejected.attempts[0]?.sessionId, turnId: "turn-operation-2" });
		expect(launches()).toEqual(["operation-1"]);
	},
);
