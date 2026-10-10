import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { SessionService } from "#session/service.ts";
import { receipt, sessionHarness } from "#test/session.ts";

describe("single session service", () => {
	it.effect("persists each exact acknowledgement before the next mutation and keeps provisioning separate", function* () {
		const events: string[] = [];
		const result = yield* Effect.gen(function* () {
			const session = yield* SessionService;
			expect(yield* session.start({ cwd: "/synthetic", operationId: "operation", prompt: "read context" })).toEqual(receipt);
			return yield* session.observe(receipt);
		}).pipe(Effect.provide(sessionHarness(events)));
		expect(events).toEqual(["session acknowledged", "session persisted", "turn submitted:synthetic-session", "turn persisted"]);
		expect(result.provisioning).toBe("unknown");
		expect(result.execution).toBe("accepted");
	});

	it.effect("does not submit a turn when persisting its session fails", function* () {
		const events: string[] = [];
		const result = yield* Effect.gen(function* () {
			const session = yield* SessionService;
			return yield* session.start({ cwd: "/synthetic", operationId: "operation", prompt: "work" }).pipe(Effect.flip);
		}).pipe(Effect.provide(sessionHarness(events, { brokenJournal: true })));
		expect(result.reason).toBe("persistence");
		expect(events).toEqual(["session acknowledged", "session persisted"]);
	});

	it.effect("reconciles lost turn acceptance without repeating the mutation", function* () {
		const events: string[] = [];
		yield* Effect.gen(function* () {
			const session = yield* SessionService;
			expect((yield* session.start({ cwd: "/synthetic", operationId: "operation", prompt: "work" }).pipe(Effect.flip)).reason).toBe("ambiguous");
			expect(yield* session.reconcile({ operationId: "operation", sessionId: receipt.sessionId })).toEqual(receipt);
		}).pipe(Effect.provide(sessionHarness(events, { lostTurn: true })));
		expect(events.filter((event) => event.startsWith("turn submitted"))).toHaveLength(1);
		expect(events.at(-1)).toBe("turn persisted");
	});

	it.effect("continues the acknowledged conversation and interrupts only on explicit command", function* () {
		const events: string[] = [];
		yield* Effect.gen(function* () {
			const session = yield* SessionService;
			yield* session.continue({ operationId: "repair", prompt: "repair", sessionId: receipt.sessionId });
			expect(yield* session.interrupt(receipt)).toEqual(receipt);
		}).pipe(Effect.provide(sessionHarness(events)));
		expect(events).toEqual(["session persisted", "turn submitted:synthetic-session", "turn persisted", "explicit interruption acknowledged"]);
	});

	it.effect("rejects foreign session or turn receipts before they reach the journal", function* () {
		for (const command of ["start", "continue", "reconcile", "observe", "interrupt"]) {
			const events: string[] = [];
			const error = yield* Effect.gen(function* () {
				const service = yield* SessionService;
				switch (command) {
					case "start":
						return yield* service.start({ cwd: "/synthetic", operationId: "operation", prompt: "work" }).pipe(Effect.flip);
					case "continue":
						return yield* service.continue({ operationId: "repair", prompt: "work", sessionId: receipt.sessionId }).pipe(Effect.flip);
					case "reconcile":
						return yield* service.reconcile({ operationId: "operation", ...receipt }).pipe(Effect.flip);
					case "observe":
						return yield* service.observe(receipt).pipe(Effect.flip);
					default:
						return yield* service.interrupt(receipt).pipe(Effect.flip);
				}
			}).pipe(Effect.provide(sessionHarness(events, { differentReceipt: true })));
			expect(error.reason).toBe("ambiguous");
			expect(events).not.toContain("turn persisted");
		}
	});

	it.effect("does not claim interruption when the provider loses its acknowledgement", function* () {
		const events: string[] = [];
		const error = yield* Effect.gen(function* () {
			const service = yield* SessionService;
			return yield* service.interrupt(receipt).pipe(Effect.flip);
		}).pipe(Effect.provide(sessionHarness(events, { interruptFailure: true })));
		expect(error.reason).toBe("ambiguous");
		expect(events).not.toContain("explicit interruption acknowledged");
	});
});
