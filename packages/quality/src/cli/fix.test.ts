import { NodeFileSystem } from "@effect/platform-node";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_FIX_ROUNDS, type Pass, type Settling, settle, snapshotOf } from "#cli/fix.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

function tree(passes: readonly ((files: Map<string, string>, round: number) => number)[]) {
	const files = new Map([
		["src/flip.ts", "a"],
		["src/still.ts", "same"],
	]);
	const ran: number[] = [];
	let round = 0;
	const steps: Pass<never, never>[] = passes.map((pass, at) => ({
		label: `with pass ${at}`,
		run: Effect.sync(() => {
			if (at === 0) {
				round += 1;
				ran.push(round);
			}
			return pass(files, round);
		}),
	}));
	return { ran, settling: { passes: steps, snapshot: Effect.sync(() => new Map(files)) } };
}

async function failureOf(settling: Settling<never, never>): Promise<string> {
	const exit = await Effect.runPromiseExit(settle(settling));
	return Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "(it settled)";
}

function flip(files: Map<string, string>): number {
	files.set("src/flip.ts", files.get("src/flip.ts") === "a" ? "b" : "a");
	return 1;
}

describe("quality fix rounds", () => {
	it("stop at the first round that rewrites nothing", async () => {
		const changes = [3, 1, 0, 2];
		const { ran, settling } = tree([(_, round) => changes[round - 1] ?? 0]);
		await Effect.runPromise(settle(settling));
		expect(ran).toEqual([1, 2, 3]);
	});

	it("fail after the last allowed round, naming the files it still changed", async () => {
		const { ran, settling } = tree([flip, () => 0]);
		expect(await failureOf(settling)).toContain(
			"Biome still rewrote files after 5 rounds, so quality fix stopped. These files changed in the last round:\n  src/flip.ts\nTwo fixes",
		);
		expect(ran).toEqual(Array.from({ length: MAX_FIX_ROUNDS }, (_, index) => index + 1));
	});

	it("name a file that one pass rewrites and the next pass restores", async () => {
		const { settling } = tree([flip, flip]);
		expect(await failureOf(settling)).toContain("These files changed in the last round:\n  src/flip.ts\nTwo fixes");
	});

	it("say where to look when Biome rewrote only files that quality fix does not read", async () => {
		const { settling } = tree([() => 1]);
		expect(await failureOf(settling)).toContain(
			"The files it changed in the last round are ones quality fix does not read, such as files .gitignore lists.\nRun `biome check --write --unsafe --verbose` to name them.",
		);
	});
});

describe("the snapshot that names the files still changing", () => {
	it("holds the text files and leaves out binary ones", async () => {
		const root = seedTree([
			{ content: "export const a = 1;\n", path: "src/a.ts" },
			{ content: "\u0089PNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR", path: "assets/logo.png" },
		]);
		const snapshot = await Effect.runPromise(Effect.provide(snapshotOf(root), NodeFileSystem.layer));
		expect([...snapshot]).toEqual([["src/a.ts", "export const a = 1;\n"]]);
	});
});
