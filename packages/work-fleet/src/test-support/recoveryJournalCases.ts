import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { finishRecoveryWorker } from "#test/recoverySteps.ts";

export function recoveryJournalCases(): readonly RecoveryCase[] {
	return [
		journalCase("missing submission intent", "missing"),
		journalCase("conflicting persisted receipt", "conflict"),
		journalCase("receipt persistence conflict", "write"),
		journalCase("ambiguous submission naming intent", "name"),
	];
}
function journalCase(name: string, fault: "missing" | "conflict" | "write" | "name"): RecoveryCase {
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
		code: "session-persistence",
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
			expect(after.step).toBe("reviewing");
			expect(after.attempts.at(-1)?.role).toBe("reviewer");
		},

		restore: () =>
			Effect.sync(() => {
				restored = true;
			}),
		sites: ["engine/reconcileCommand.ts: failureCode(error)"],
	};
}
