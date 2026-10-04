import { Cause, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { MAX_FIX_ROUNDS, settle } from "../src/cli/fix.ts";

function rounds(changes: readonly number[]) {
	const ran: number[] = [];
	let snapshots = 0;
	const settling = {
		round: (index: number) =>
			Effect.sync(() => {
				ran.push(index);
				return changes[index - 1] ?? 0;
			}),
		snapshot: Effect.sync(() => {
			snapshots += 1;
			return new Map([
				["src/flip.ts", String(snapshots % 2)],
				["src/still.ts", "same"],
			]);
		}),
	};
	return { ran, settling };
}

describe("quality fix rounds", () => {
	it("stop at the first round that rewrites nothing", async () => {
		const { ran, settling } = rounds([3, 1, 0, 2]);
		await Effect.runPromise(settle(settling));
		expect(ran).toEqual([1, 2, 3]);
	});

	it("fail after the last allowed round, naming the files it still changed", async () => {
		const { ran, settling } = rounds(Array.from({ length: MAX_FIX_ROUNDS + 1 }, () => 1));
		const exit = await Effect.runPromiseExit(settle(settling));
		expect(ran).toEqual([1, 2, 3, 4, 5]);
		expect(Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "(it settled)").toContain(
			"Biome still rewrote files after 5 rounds, so quality fix stopped. These files changed in the last round:\n  src/flip.ts\nTwo fixes",
		);
	});
});
