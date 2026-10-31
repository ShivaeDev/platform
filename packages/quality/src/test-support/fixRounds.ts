import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Console, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { settle, snapshotOf } from "#cli/fix.ts";
import { services } from "#cli/runMain.ts";
import { capturing, type Output } from "./cli.ts";
import type { SeedFile } from "./tree.ts";

type Pass = () => number;

interface FixEngine {
	failure: string | undefined;
	fixPass: Pass;
	formatPass: Pass;
	outcome: "settled" | "stopped" | undefined;
	readonly output: Output;
	readonly root: string;
}

const REWRITE = Buffer.from(" rewritten");

function rewriting(root: string, paths: readonly string[], rewrite: (original: Buffer, current: Buffer) => Buffer): Pass {
	const originals = paths.map((path) => [join(root, path), readFileSync(join(root, path))] as const);
	return () => {
		for (const [path, original] of originals) {
			writeFileSync(path, rewrite(original, readFileSync(path)));
		}
		return originals.length;
	};
}

function fixed(engine: FixEngine): FixEngine {
	if (engine.outcome === undefined) {
		throw new Error("Run quality fix before reading what it did");
	}
	return engine;
}

export const fixRounds = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync(
				(): FixEngine => ({
					failure: undefined,
					fixPass: () => 0,
					formatPass: () => 0,
					outcome: undefined,
					output: { stderr: "", stdout: "" },
					root: mkdtempSync(join(tmpdir(), "quality-fix-")),
				}),
			),
			(engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true })),
		),
	inspect: ({ failure, outcome, output }) => ({ failure, outcome, rounds: output.stdout }),
	layer: services,
	name: "Quality fix rounds",
	stages: ["repository", "biome"],
	verbs: (engine, story) => ({
		failure: () => Effect.sync(() => fixed(engine).failure),
		fixes: () =>
			Effect.gen(function* () {
				story.tell("the author runs quality fix, which repeats Biome's fix pass and format pass in rounds");
				const passes = [
					{ label: "with fixes", run: Effect.sync(engine.fixPass) },
					{ label: "with the format pass", run: Effect.sync(engine.formatPass) },
				];
				engine.outcome = yield* settle({ passes, snapshot: snapshotOf(engine.root) }).pipe(
					Effect.provideService(Console.Console, capturing(engine.output)),
					Effect.match({
						onFailure: (failure) => {
							engine.failure = failure.message;
							return "stopped" as const;
						},
						onSuccess: () => "settled" as const,
					}),
				);
			}),
		outcome: () => Effect.sync(() => fixed(engine).outcome),
		rounds: () =>
			Effect.sync(() =>
				fixed(engine)
					.output.stdout.split("\n")
					.filter((line) => line !== ""),
			),
	}),
});

export function repositoryHas(...files: readonly SeedFile[]) {
	return fixRounds.trait("repository", `the repository contains ${files.map((file) => file.path).join(", ")}`, (engine) => {
		for (const file of files) {
			mkdirSync(dirname(join(engine.root, file.path)), { recursive: true });
			writeFileSync(join(engine.root, file.path), file.content);
		}
	});
}

export function fixPassReports(...changed: readonly number[]) {
	return fixRounds.trait("biome", `Biome's fix pass reports ${changed.join(", ")} rewritten files in successive rounds and 0 after`, (engine) => {
		const reports = [...changed];
		engine.fixPass = () => reports.shift() ?? 0;
	});
}

export function fixPassKeepsRewriting(...paths: readonly string[]) {
	return fixRounds.trait("biome", `Biome's fix pass rewrites ${paths.join(" and ")} back and forth in every round`, (engine) => {
		engine.fixPass = rewriting(engine.root, paths, (original, current) => (current.equals(original) ? Buffer.concat([original, REWRITE]) : original));
	});
}

export function formatPassRestores(path: string) {
	return fixRounds.trait("biome", `Biome's format pass restores ${path} to its original text in every round`, (engine) => {
		engine.formatPass = rewriting(engine.root, [path], (original) => original);
	});
}
