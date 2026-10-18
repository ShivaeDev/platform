import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { receipt } from "#test/session.ts";
import { sessionStory, transportDoes } from "#test/sessionStory.ts";

describe("single session service", () => {
	sessionStory.it("retains a session when its transport has no archive capability", [], function* ({ session, events }) {
		yield* Effect.gen(function* () {
			yield* session.archive(receipt.sessionId);
		});
		expect(events()).toEqual([]);
	});
	sessionStory.it(
		"persists each exact acknowledgement before the next mutation and keeps provisioning separate",
		[],
		function* ({ session, events }) {
			const result = yield* Effect.gen(function* () {
				expect(yield* session.start({ cwd: "/synthetic", operationId: "operation", prompt: "read context" })).toEqual(receipt);
				return yield* session.observe(receipt);
			});
			expect(events()).toEqual(["session acknowledged", "session persisted", "turn submitted:synthetic-session", "turn persisted"]);
			expect(result.provisioning).toBe("unknown");
			expect(result.execution).toBe("accepted");
		},
	);
	sessionStory.it(
		"does not submit a turn when persisting its session fails",
		[transportDoes({ brokenJournal: true })],
		function* ({ session, events }) {
			const result = yield* Effect.gen(function* () {
				return yield* session.start({ cwd: "/synthetic", operationId: "operation", prompt: "work" }).pipe(Effect.flip);
			});
			expect(result.reason).toBe("persistence");
			expect(events()).toEqual(["session acknowledged", "session persisted"]);
		},
	);
	sessionStory.it(
		"reconciles lost turn acceptance without repeating the mutation",
		[transportDoes({ lostTurn: true })],
		function* ({ session, events }) {
			yield* Effect.gen(function* () {
				expect((yield* session.start({ cwd: "/synthetic", operationId: "operation", prompt: "work" }).pipe(Effect.flip)).reason).toBe("ambiguous");
				expect(yield* session.reconcile({ operationId: "operation", sessionId: receipt.sessionId })).toEqual(receipt);
			});
			expect(events().filter((event) => event.startsWith("turn submitted"))).toHaveLength(1);
			expect(events().at(-1)).toBe("turn persisted");
		},
	);
	sessionStory.it("continues the acknowledged conversation and interrupts only on explicit command", [], function* ({ session, events }) {
		yield* Effect.gen(function* () {
			yield* session.continue({ operationId: "repair", prompt: "repair", sessionId: receipt.sessionId });
			expect(yield* session.interrupt(receipt)).toEqual(receipt);
		});
		expect(events()).toEqual(["session persisted", "turn submitted:synthetic-session", "turn persisted", "explicit interruption acknowledged"]);
	});
	sessionStory.it(
		"rejects foreign session or turn receipts before they reach the journal",
		[transportDoes({ differentReceipt: true })],
		function* ({ session, events }) {
			for (const command of ["start", "continue", "reconcile", "observe", "interrupt"]) {
				const error = yield* Effect.gen(function* () {
					switch (command) {
						case "start":
							return yield* session.start({ cwd: "/synthetic", operationId: "operation", prompt: "work" }).pipe(Effect.flip);
						case "continue":
							return yield* session.continue({ operationId: "repair", prompt: "work", sessionId: receipt.sessionId }).pipe(Effect.flip);
						case "reconcile":
							return yield* session.reconcile({ operationId: "operation", ...receipt }).pipe(Effect.flip);
						case "observe":
							return yield* session.observe(receipt).pipe(Effect.flip);
						default:
							return yield* session.interrupt(receipt).pipe(Effect.flip);
					}
				});
				expect(error.reason).toBe("ambiguous");
				expect(events()).not.toContain("turn persisted");
			}
		},
	);
	sessionStory.it(
		"does not claim interruption when the provider loses its acknowledgement",
		[transportDoes({ interruptFailure: true })],
		function* ({ session, events }) {
			const error = yield* Effect.gen(function* () {
				return yield* session.interrupt(receipt).pipe(Effect.flip);
			});
			expect(error.reason).toBe("ambiguous");
			expect(events()).not.toContain("explicit interruption acknowledged");
		},
	);
});
