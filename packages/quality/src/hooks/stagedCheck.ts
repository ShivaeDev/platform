import * as NodePath from "@effect/platform-node/NodePath";
import { Console, Effect, Path } from "effect";
import { manifestReader } from "#adapters/manifestReader.ts";
import { biomeReport } from "#biome/report.ts";
import type { ResolvedConfig } from "#config/load.ts";
import { readBaseline } from "#engine/baselineFile.ts";
import { evaluate, type Outcome, passes } from "#engine/evaluate.ts";
import type { Violation } from "#engine/violation.ts";
import { registryEntries } from "#exceptions/registryEntries.ts";
import { SetupFailure } from "#failure.ts";
import { gitOrFail } from "#git/command.ts";
import { withStagedContent } from "#hooks/withStagedContent.ts";
import { type ReportContext, renderFindings } from "#report/render.ts";
import { failingFindings } from "#rules/biome.ts";

const BIOME = ["check", "--files-ignore-unknown=true", "--no-errors-on-unmatched"];

function pathsOf(output: string): readonly string[] {
	return output.split("\0").filter((path) => path !== "");
}

function failed(error: { readonly message: string }): SetupFailure {
	return new SetupFailure({ cause: error, message: error.message });
}

export const stagedCheck = Effect.fn("Hooks.stagedCheck")(function* (config: ResolvedConfig) {
	const { relative } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const staged = pathsOf(yield* gitOrFail(config.root, ["diff", "--cached", "--name-only", "--relative", "--diff-filter=d", "-z"]));
	const unstaged = new Set(pathsOf(yield* gitOrFail(config.root, ["diff", "--name-only", "--relative", "-z"])));
	const edited = staged.filter((path) => unstaged.has(path));
	yield* Console.log(
		`quality: checking ${staged.length === 1 ? "the staged file" : `the ${staged.length} staged files`} with Biome only, as preCommit is "staged".`,
	);
	const report =
		staged.length === 0
			? { diagnostics: [] }
			: yield* withStagedContent(config.root, edited, biomeReport(config.root, BIOME, config.exceptions, staged, config.nonEffectFolders)).pipe(
					Effect.mapError(failed),
				);
	const findings = yield* failingFindings({ readText: yield* manifestReader(config.root) }, report.diagnostics).pipe(Effect.mapError(failed));
	const violations = findings.map((finding): Violation => ({ ...finding, level: "error", rule: `biome/${finding.subject ?? "internal"}` }));
	const baseline = yield* readBaseline(config);
	const evaluated = evaluate(violations, registryEntries(config.exceptions), baseline.entries, config);
	const outcome: Outcome = { ...evaluated, looseBaseline: [], staleBaseline: [], staleRegistry: [] };
	const context: ReportContext = {
		baseline: config.baseline,
		checked: staged.length,
		descriptions: new Map(config.active.map((rule) => [rule.id, rule.description])),
		registry: config.exceptions.length === 0 ? config.registry : `${relative(config.root, config.file)} exceptions`,
	};
	yield* Console.log(renderFindings(outcome, context));
	return passes(outcome);
});
