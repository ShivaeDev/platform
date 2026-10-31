import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ambiguousProviderRejection, permanentProviderRejection, providerCapacityRejected } from "#test/engineCapacityTraits.ts";
import { engine } from "#test/engineStory.ts";

const QUEUE_FULL = "Codex rejected the protocol request: App-server request queue is full. Please retry.";
const CAPACITY_WAIT = "Waiting for provider capacity; last rejection 1970-01-01T00:00:00.100Z";

for (const rejectedCall of ["session", "turn"] as const) {
	engine.it(
		`a capacity-rejected ${rejectedCall} waits on automation for provider capacity without a decision`,
		[providerCapacityRejected(rejectedCall)],
		function* (fleet) {
			yield* fleet.prepareWork("one");

			yield* fleet.schedule();

			yield* outcomes([
				[
					"one",
					() => fleet.get("one"),
					{
						value: {
							attempts: [{ output: QUEUE_FULL, status: "failed" }],
							launchRetry: { rejectedAt: 100, rejections: 1, retryAt: 30_100 },
							step: "queued",
						},
					},
				],
				["execution", () => fleet.executionOf("one"), "not executing"],
				[
					"status",
					() => fleet.statusText(),
					expect.toSatisfy((status: string) =>
						["Active (0)", "Waiting on automation (1)", CAPACITY_WAIT, "Waiting on you (0)", "Waiting on orchestrator (0)"].every((line) =>
							status.includes(line),
						),
					),
				],
			]);
			expect(fleet.publishedDecisions()).toEqual([]);
		},
	);

	engine.it(
		`a capacity-rejected ${rejectedCall} launches across a restart only once its retry time arrives${rejectedCall === "turn" ? ", in its first session" : ""}`,
		[providerCapacityRejected(rejectedCall)],
		function* (fleet) {
			yield* fleet.prepareWork("one");
			yield* fleet.schedule();
			const queued = (yield* fleet.get("one")).value;
			fleet.recoverProvider();
			fleet.advanceTime(30_099 - fleet.currentTime());
			yield* fleet.restart();
			yield* fleet.schedule();
			expect(fleet.launches()).toEqual(["operation-1"]);

			fleet.advanceTime(30_100 - fleet.currentTime());
			yield* fleet.restart();
			yield* fleet.schedule();

			const accepted = (yield* fleet.get("one")).value;
			expect(accepted.step).toBe("working");
			expect(accepted.launchRetry).toBeUndefined();
			expect(accepted.attempts.at(-1)?.receipt?.sessionId).toEqual(rejectedCall === "turn" ? queued.attempts[0]?.sessionId : expect.any(String));
			expect(fleet.launches()).toEqual(rejectedCall === "turn" ? ["operation-1"] : ["operation-1", "operation-2"]);
			expect(yield* fleet.statusText()).not.toContain("Waiting for provider capacity");
		},
	);
}

engine.it(
	"a full provider queue stops the pass and holds the backlog through doubling backoff until the provider recovers",
	[providerCapacityRejected()],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.prepareWork("two");
		for (const delay of [30_000, 60_000, 120_000, 240_000]) {
			expect(yield* fleet.scheduledDispatches()).toEqual(["dispatched one"]);
			yield* outcomes([
				["one", () => fleet.get("one"), { value: { launchRetry: { retryAt: fleet.currentTime() + delay } } }],
				["attempts on two", () => fleet.attemptsOf("two"), 0],
			]);
			const calls = fleet.launches().length;
			fleet.advanceTime(delay - 1);
			yield* fleet.restart();
			yield* fleet.schedule();
			expect(fleet.launches()).toHaveLength(calls);
			fleet.advanceTime(1);
		}

		fleet.recoverProvider();
		const dispatched = yield* fleet.scheduledDispatches();

		expect(dispatched).toEqual(["dispatched one", "dispatched two"]);
		expect(yield* fleet.workStages(["one", "two"])).toEqual({ one: "working", two: "working" });
		expect(fleet.publishedDecisions()).toEqual([]);
	},
);

engine.it(
	"a permanent rejection asks the human for each work item without stopping the other launches",
	[permanentProviderRejection()],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.prepareWork("two");

		expect(yield* fleet.scheduledDispatches()).toEqual(["dispatched one", "dispatched two"]);

		const one = (yield* fleet.get("one")).value;
		const two = (yield* fleet.get("two")).value;
		expect(one).toMatchObject({ decision: { code: "session-rejected", reason: QUEUE_FULL }, step: "waiting" });
		expect(one.launchRetry).toBeUndefined();
		expect(fleet.publishedDecisions()).toEqual([one.decision?.reason, two.decision?.reason]);
	},
);

engine.it(
	"an ambiguous queue-full message keeps the launch executing without resubmitting it after a restart",
	[ambiguousProviderRejection()],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		const submitted = (yield* fleet.dispatch("one")).value;
		expect(submitted.launchRetry).toBeUndefined();
		expect(yield* fleet.executionOf("one")).toBe("executing");

		yield* fleet.restart();
		yield* fleet.schedule();

		expect(fleet.launches()).toEqual(["operation-1"]);
	},
);

engine.it(
	"a launch retry rechecks the Board and replaces the capacity wait with the human approval blocker",
	[providerCapacityRejected()],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.schedule();
		expect(yield* fleet.statusText()).toContain("Waiting for provider capacity");
		fleet.editWork("one", "changed-board");
		fleet.advanceTime(30_100 - fleet.currentTime());

		yield* fleet.restart();
		yield* fleet.schedule();

		expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
		const status = yield* fleet.statusText();
		expect(status).toMatch(/Waiting on you \(1\)[\s\S]*Work is no longer approved/u);
		expect(status).not.toContain("Waiting for provider capacity");
		expect(fleet.launches()).toEqual(["operation-1"]);
	},
);
