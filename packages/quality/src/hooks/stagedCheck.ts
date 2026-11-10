import * as NodePath from "@effect/platform-node/NodePath";
import { Console, Effect, FileSystem, Path } from "effect";
import { manifestReader } from "#adapters/manifestReader.ts";
import { biomeReport } from "#biome/report.ts";
import type { ResolvedConfig } from "#config/load.ts";
import { readBaseline } from "#engine/baselineFile.ts";
import { evaluate, type Outcome, passes } from "#engine/evaluate.ts";
import type { Violation } from "#engine/violation.ts";
import { registryEntries } from "#exceptions/registryEntries.ts";
import { SetupFailure } from "#failure.ts";
import { gitOrFail } from "#git/command.ts";
import { orWhenAbsent } from "#inventory/filesystem.ts";
import { type ReportContext, renderFindings } from "#report/render.ts";
import { failingFindings } from "#rules/biome.ts";

const BIOME = ["check", "--files-ignore-unknown=true", "--no-errors-on-unmatched"];

function pathsOf(output: string): readonly string[] {
	return output.split("\0").filter((path) => path !== "");
}

function failed(error: { readonly message: string }): SetupFailure {
	return new SetupFailure({ cause: error, message: error.message });
}

const workingCopies = Effect.fn("Hooks.workingCopies")(function* (root: string, paths: readonly string[]) {
	const { join } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const fs = yield* FileSystem.FileSystem;
	return yield* Effect.forEach(paths, (path) =>
		Effect.map(orWhenAbsent<Uint8Array | undefined>(join(root, path), fs.readFile(join(root, path)), undefined), (bytes) => ({
			bytes,
			path: join(root, path),
		})),
	).pipe(Effect.mapError(failed));
});

const restore = Effect.fn("Hooks.restore")(function* (copies: readonly { readonly bytes: Uint8Array | undefined; readonly path: string }[]) {
	const fs = yield* FileSystem.FileSystem;
	yield* Effect.forEach(copies, ({ bytes, path }) => (bytes === undefined ? fs.remove(path, { force: true }) : fs.writeFile(path, bytes))).pipe(
		Effect.mapError(failed),
	);
});

// Biome reads files only from disk, so a file edited again after staging shows Biome its staged content until the check ends.
const withStagedContent = Effect.fn("Hooks.withStagedContent")(function* <TValue, TError, TRequirements>(
	root: string,
	edited: readonly string[],
	check: Effect.Effect<TValue, TError, TRequirements>,
) {
	if (edited.length === 0) {
		return yield* check;
	}
	return yield* Effect.acquireUseRelease(
		Effect.tap(workingCopies(root, edited), () => gitOrFail(root, ["--literal-pathspecs", "checkout-index", "--force", "--", ...edited])),
		() => check,
		(copies) => restore(copies),
	);
});

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
