import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import type { Findings, Rule } from "@shivaedev/quality/rule.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { scanned } from "#quality-fixtures/imports.ts";
import type { SeedFile } from "#quality-fixtures/tree.ts";
import { resolveRules } from "#quality-internal/config/resolve.ts";

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
		checksDefault: (id: string) =>
			Effect.gen(function* () {
				story.tell(`the author checks the default ${id} rule`);
				const resolved = yield* resolveRules({});
				if (resolved._tag === "Invalid") {
					throw new Error(resolved.issues.join("; "));
				}
				const active = resolved.value.active.find((rule) => rule.id === id);
				if (active === undefined) {
					throw new Error(`No default rule named ${id}`);
				}
				engine.findings = yield* Effect.promise(async () => active.check(await scanned(engine.root)));
				return engine.findings;
			}),
		writes: (...files: readonly SeedFile[]) =>
			Effect.sync(() => {
				for (const file of files) {
					story.tell(`the author writes ${file.path}`);
					const path = join(engine.root, file.path);
					mkdirSync(dirname(path), { recursive: true });
					writeFileSync(path, file.content);
				}
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
