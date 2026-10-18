import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import type { Findings, Rule } from "@shivaedev/quality/rule.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { scanned } from "#quality-fixtures/imports.ts";
import type { SeedFile } from "#quality-fixtures/tree.ts";

interface RuleEngine {
	findings: Findings;
	readonly root: string;
}

export const ruleKit = storyKit({
	create: () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "quality-rule-"));
			yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
			return { findings: [], root } satisfies RuleEngine;
		}),
	inspect: (engine: RuleEngine) => ({ findings: engine.findings }),
	name: "Quality rule engine",
	stages: ["repository"],
	verbs: (engine: RuleEngine, story) => ({
		checks: <TInput>(rule: Rule<string, TInput>, options?: TInput) =>
			Effect.promise(async () => {
				story.tell(`the author checks ${rule.id}`);
				const configured = await rule.configure(options);
				if (configured._tag === "Invalid") {
					throw new Error(configured.issues.join("; "));
				}
				engine.findings = await configured.check(await scanned(engine.root));
				return engine.findings;
			}),
	}),
});

export function repositoryHas(...files: readonly SeedFile[]) {
	return ruleKit.trait("repository", `the repository contains ${files.map((file) => file.path).join(", ")}`, (engine) => {
		for (const file of files) {
			const path = join(engine.root, file.path);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, file.content);
		}
	});
}
