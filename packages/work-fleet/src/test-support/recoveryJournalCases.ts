import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { finishRecoveryWorker } from "#test/recoverySteps.ts";

export function recoveryJournalCases(): readonly RecoveryCase[] {
	return [
		journalCase("missing submission intent", "Submission intent was not persisted", "missing"),
		journalCase(
			"conflicting persisted receipt",
			"Independent review or submission acknowledgement conflicts with the persisted exact receipt",
			"conflict",
		),
		journalCase("receipt persistence conflict", "Receipt persistence failed; reconcile the existing operation", "write"),
		journalCase("ambiguous submission naming intent", "Submission intent is missing or ambiguous", "name"),
	];
}
function journalCase(name: string, reason: string, fault: "missing" | "conflict" | "write" | "name"): RecoveryCase {
	let context: RecoveryContext | undefined;
	let restored = false;
	let conflict = false;
	const failJournal = Effect.fnUntraced(function* () {
		if (restored) {
			return;
		}
		if (context === undefined) {
			return yield* Effect.die("Missing recovery context");
		}
		const { fixture } = context;
		const operation = [...fixture.operations.entries()].at(-1);
		if (operation === undefined) {
			return yield* Effect.die("Missing persisted receipt");
		}
		conflict = fault === "write";
		yield* (
			fault === "name"
				? fixture.sessionName("missing-operation")
				: fixture.acknowledgeTurn(fault === "missing" ? "missing-operation" : operation[0], {
						...operation[1],
						...(fault === "conflict" ? { turnId: "different-turn" } : {}),
					})
		).pipe(
			Effect.mapError((error) => new SessionFailure({ message: error instanceof Error ? error.message : String(error), reason: "persistence" })),
		);
	});
	return {
		enter: Effect.fnUntraced(function* (ctx) {
			context = ctx;
			yield* finishRecoveryWorker(ctx);
		}),
		name,
		options: {
			decorateTransport: (transport) => ({
				...transport,
				observe: (input) => failJournal().pipe(Effect.andThen(transport.observe(input))),
			}),
			writeGate: (value) =>
				Effect.gen(function* () {
					if (conflict && context !== undefined) {
						conflict = false;
						yield* context.fixture.replaceRecord(value).pipe(Effect.orDie);
					}
				}),
		},
		progress: (_ctx, _before, after) => {
			expect(after.stage).toBe("reviewing");
			expect(after.attempts.at(-1)?.role).toBe("reviewer");
		},
		reason,
		restore: () =>
			Effect.sync(() => {
				restored = true;
			}),
		sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
	};
}
