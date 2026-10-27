import { expect } from "@effect/vitest";
import { Effect, Fiber, Schedule } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";
import { readableBoard } from "#test/readableBoard.ts";

isolatedEngine.it(
	"an answer is recorded and applied while an older Board scan is running",
	[readableBoard()],
	function* ({ prepareWork, fleet, workerQuestion, pauseBoardScan, startHostAnswer }) {
		yield* prepareWork("item.0");
		yield* fleet.dispatch("item.0");
		yield* workerQuestion("item.0", "Which scope should I use?");
		const waiting = (yield* fleet.reconcile("item.0")).value;
		expect(waiting.step).toBe("waiting");
		const answer = yield* startHostAnswer("item.0", "Use the approved scope.");
		yield* answer.beforePublish;
		const scan = yield* pauseBoardScan();
		yield* answer.publish;
		yield* answer.reading;
		yield* Effect.yieldNow;
		yield* scan.release;
		yield* Fiber.join(scan.read);
		yield* Fiber.join(answer.result);
		const applied = yield* fleet
			.get("item.0")
			.pipe(
				Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (record) => record.value.step === "working" }),
				Effect.timeout("5 seconds"),
			);
		expect(applied.value.responses).toContainEqual(expect.objectContaining({ action: "continue", decisionId: waiting.decision?.id }));
		expect(applied.value.attempts.at(-1)?.prompt).toBe("Use the approved scope.");
	},
	{ clock: "live" },
);
