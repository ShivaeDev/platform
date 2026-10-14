import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { boardReads } from "#test/boardReads.ts";
import { prepareWork, withEngine } from "#test/engine.ts";

export const boardReadRecovery = Effect.fn("Test.boardReadRecovery")(function* (source: string) {
	let now = 100;
	const board = yield* boardReads(1);
	return yield* withEngine(
		{ now: () => now },
		(fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("item.0");
				yield* fleet.dispatch("item.0");
				board.unreadable.add(source);
				const waiting = (yield* fleet.reconcile("item.0")).value;
				expect(waiting.stage).toBe("executing");
				expect(waiting.decision).toBeUndefined();
				expect(waiting.attentionOwner).toBe("automation");
				expect(waiting.blocker).toContain(source === "." ? "Board sources could not be listed" : "Board source could not be read");
				expect(waiting.integrationRetry).toMatchObject({ failures: 1, retryAt: 30_100 });
				const scans = board.scans();
				now = 30_099;
				yield* fixture.restart(cycle);
				expect(board.scans()).toBe(scans);
				board.unreadable.clear();
				now = 30_100;
				yield* fixture.restart(cycle);
				const recovered = (yield* fleet.get("item.0")).value;
				expect(recovered.stage).toBe("executing");
				expect(recovered.decision).toBeUndefined();
				expect(recovered.integrationRetry).toBeUndefined();
				expect(recovered.blocker).toBeUndefined();
				expect(recovered.attentionOwner).toBeUndefined();
				expect(recovered.attempts).toEqual(waiting.attempts);
				expect(fixture.launched).toHaveLength(1);
			}),
		board.board,
	);
}, Effect.scoped);

export const boardReadExhaustion = Effect.fn("Test.boardReadExhaustion")(function* () {
	let now = 100;
	const board = yield* boardReads(1);
	return yield* withEngine(
		{ now: () => now },
		(fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("item.0");
				yield* fleet.dispatch("item.0");
				board.unreadable.add(".");
				for (let failure = 1; failure <= 5; failure += 1) {
					const failed = (yield* fleet.reconcile("item.0")).value;
					if (failure < 5) {
						expect(failed.decision).toBeUndefined();
						expect(failed.integrationRetry).toMatchObject({ failures: failure });
						now = failed.integrationRetry?.retryAt ?? 0;
					}
				}
				const parked = (yield* fleet.get("item.0")).value;
				expect(parked.stage).toBe("needs-human");
				expect(parked.decision?.reason).toContain("read failure after 5 attempts");
				expect(parked.decisionPublished).toBe(false);
				expect((yield* fleet.reconcile("item.0")).value.decision).toEqual(parked.decision);
				board.unreadable.clear();
				yield* fixture.restart(cycle);
				const published = (yield* fleet.get("item.0")).value;
				expect(published.decision?.id).toBe(parked.decision?.id);
				expect(published.decisionPublished).toBe(true);
				yield* fixture.restart(cycle);
				expect((yield* fleet.get("item.0")).value.decision).toEqual(published.decision);
				expect(fixture.launched).toHaveLength(1);
			}),
		board.board,
	);
}, Effect.scoped);

export const boardDispatchRetry = Effect.fn("Test.boardDispatchRetry")(function* () {
	let now = 100;
	const board = yield* boardReads(1);
	return yield* withEngine(
		{ now: () => now },
		(fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("item.0");
				board.unreadable.add(".");
				const waiting = (yield* fleet.dispatch("item.0")).value;
				expect(waiting.stage).toBe("prepared");
				expect(waiting.decision).toBeUndefined();
				expect(waiting.attentionOwner).toBe("automation");
				expect(waiting.integrationRetry).toMatchObject({ failures: 1, retryAt: 30_100 });
				const scans = board.scans();
				yield* fixture.restart(cycle);
				expect(board.scans()).toBe(scans);
				expect((yield* fleet.get("item.0")).value.integrationRetry).toEqual(waiting.integrationRetry);
				board.unreadable.clear();
				now = 30_100;
				yield* fixture.restart(cycle);
				const recovered = (yield* fleet.get("item.0")).value;
				expect(recovered.stage).toBe("executing");
				expect(recovered.integrationRetry).toBeUndefined();
				expect(recovered.blocker).toBeUndefined();
				expect(recovered.attentionOwner).toBeUndefined();
				expect(fixture.launched).toHaveLength(1);
			}),
		board.board,
	);
}, Effect.scoped);
