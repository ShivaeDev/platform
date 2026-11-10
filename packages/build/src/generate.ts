import { Effect, Option, Path } from "effect";
import { withHeavyLock } from "@shivaedev/heavy-lock/withHeavyLock.ts";
import { deriveModules } from "#adapters/typeScript.ts";
import { byText } from "#byText.ts";
import { cachedOutput, recordOutput } from "#cache.ts";
import { emit } from "#emit.ts";
import { readIfPresent, writeAtomically } from "#files.ts";
import { inputKey } from "#inputs.ts";
import { plan } from "#plan.ts";
import { moduleFiles, openProject } from "#project.ts";
import { GenerateFailed, type GenerateReport, type ModuleOutcome, problemOf } from "#report.ts";
import { settleOrphans } from "#settleOrphans.ts";

export interface GenerateOptions {
	// Writes nothing and fails when a generated file is missing or differs from what generate would write.
	readonly check: boolean;
}

const settle = Effect.fn("Build.settle")(function* (options: GenerateOptions, output: string, content: string, fromCache: boolean) {
	const existing = yield* readIfPresent(output);
	if (Option.contains(existing, content)) {
		return fromCache ? "unchanged" : "current";
	}
	if (options.check) {
		return Option.isNone(existing) ? "missing" : "stale";
	}
	yield* writeAtomically(output, content);
	return "written";
});

export const generate = Effect.fn("Build.generate")(function* (directory: string, options: GenerateOptions) {
	const path = yield* Path.Path;
	const project = yield* openProject(directory);
	const files = yield* moduleFiles(project);
	const refusals = files.flatMap(({ module, underSource }) =>
		underSource
			? []
			: [
					`${path.relative(project.root, module)}: defines a module outside src; move it under src, since its generated file goes to src/generated/<its path under src>`,
				],
	);
	const placed = files.filter(({ underSource }) => underSource);
	const keyed = yield* Effect.forEach(placed, (file) =>
		Effect.gen(function* () {
			const { files: inputs, key } = yield* inputKey(project, file.module);
			return { ...file, cached: yield* cachedOutput(project.root, file.module, key), inputs, key };
		}),
	);
	const pending = keyed.filter(({ cached }) => Option.isNone(cached));
	const facts =
		pending.length === 0
			? []
			: yield* withHeavyLock(
					deriveModules(
						project.config,
						pending.map(({ module }) => module),
					),
					{ command: "shivaedev-build generate" },
				);
	const outcomes: ModuleOutcome[] = [];
	for (const file of keyed) {
		const relative = { module: path.relative(project.root, file.module), output: path.relative(project.root, file.output) };
		const derived = facts.find((each) => each.file === file.module);
		const planned = derived === undefined ? undefined : yield* plan({ output: file.output, root: project.root }, derived);
		if (planned !== undefined && planned.refusals.length > 0) {
			refusals.push(...planned.refusals);
			outcomes.push({ ...relative, status: "refused" });
			continue;
		}
		const content = Option.getOrElse(file.cached, () => (planned === undefined ? "" : emit(planned.planned)));
		const status = yield* settle(options, file.output, content, Option.isSome(file.cached));
		if (!options.check && Option.isNone(file.cached)) {
			yield* recordOutput(project.root, file.module, file.key, content);
		}
		outcomes.push({ ...relative, status });
	}
	outcomes.push(...(yield* settleOrphans(project, options.check)));
	const inputs = [...new Set(keyed.flatMap((file) => file.inputs))].sort(byText);
	const report: GenerateReport = { inputs, modules: outcomes, programBuilt: pending.length > 0 };
	const lines = outcomes.flatMap((outcome) => problemOf(outcome) ?? []);
	if (refusals.length > 0 || lines.length > 0) {
		const problems = [...refusals, ...lines].map((problem) => problem.replaceAll(`${project.root}${path.sep}`, ""));
		return yield* new GenerateFailed({ problems, report });
	}
	return report;
});
