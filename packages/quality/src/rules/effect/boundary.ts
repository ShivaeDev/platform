import { join } from "node:path";
import { Effect } from "effect";
import { isPackageRootConfig } from "#imports/isTooling.ts";
import { packageOf, type WorkspacePackage, workspacePackages } from "#imports/workspace.ts";
import { defineRule, type Finding, type RuleInputs, type SourceFile } from "#rule.ts";
import { boundaryFindings } from "#rules/effect/boundaryFindings.ts";
import { moduleBinder } from "#rules/effect/boundaryReference.ts";
import { workspaceProgram } from "#rules/effect/workspaceProgram.ts";
import { parse } from "#rules/parse.ts";

function groupsOf(inputs: RuleInputs, packages: readonly WorkspacePackage[]): readonly (readonly SourceFile[])[] {
	const groups = new Map<string, SourceFile[]>();
	for (const source of inputs.sources) {
		if (
			/(?:^|\/)(?:adapters|test-support)\//u.test(source.path)
			|| !/\.[cm]?[jt]sx?$/u.test(source.path)
			|| isPackageRootConfig(packageOf(packages, source.path)?.directory ?? ".", source.path)
		) {
			continue;
		}
		const group = /^(?:packages|examples)\/[^/]+/u.exec(source.path)?.[0] ?? ".";
		const sources = groups.get(group) ?? [];
		sources.push(source);
		groups.set(group, sources);
	}
	return [...groups.values()];
}

function syntaxFindings(sources: readonly SourceFile[], workspace: ReadonlySet<string>): readonly Finding[] {
	const { checker, parsed } = moduleBinder(sources);
	const found = boundaryFindings(checker, workspace, false);
	return [...parsed].flatMap(([path, source]) => found(path, source));
}

const everyFinding = Effect.fn("Boundary.everyFinding")(function* (inputs: RuleInputs, workspace: ReadonlySet<string>) {
	const program = yield* workspaceProgram(inputs);
	const found = boundaryFindings(program.getTypeChecker(), workspace, true);
	return inputs.sources.flatMap((file) => {
		const source = parse(file) === undefined ? undefined : program.getSourceFile(join(inputs.root, file.path));
		return source === undefined ? [] : found(file.path, source);
	});
});

function eachGroup<TError, TServices>(
	inputs: RuleInputs,
	check: (sources: readonly SourceFile[], workspace: ReadonlySet<string>) => Effect.Effect<readonly Finding[], TError, TServices>,
) {
	return Effect.flatMap(workspacePackages(inputs), (packages) => {
		const workspace = new Set(packages.map((owner) => owner.name));
		return Effect.map(
			Effect.forEach(groupsOf(inputs, packages), (sources) => check(sources, workspace)),
			(found) => found.flat(),
		);
	});
}

const syntaxRuns = new WeakMap<readonly SourceFile[], readonly Finding[]>();

function syntaxHalf(inputs: RuleInputs) {
	return Effect.tap(
		eachGroup(inputs, (sources, workspace) => Effect.sync(() => syntaxFindings(sources, workspace))),
		(found) => Effect.sync(() => syntaxRuns.set(inputs.sources, found)),
	);
}

function keyOf(finding: Finding): string {
	return `${finding.file}\u0000${String(finding.line)}\u0000${finding.message}`;
}

function without(found: readonly Finding[], syntax: readonly Finding[]): readonly Finding[] {
	const left = new Map<string, number>();
	for (const finding of syntax) {
		left.set(keyOf(finding), (left.get(keyOf(finding)) ?? 0) + 1);
	}
	return found.filter((finding) => {
		const count = left.get(keyOf(finding)) ?? 0;
		left.set(keyOf(finding), count - 1);
		return count <= 0;
	});
}

// The typed half reports what the whole rule finds beyond the syntax half, whose findings a full run reuses.
function typedHalf(inputs: RuleInputs) {
	const syntax = Effect.suspend(() => {
		const done = syntaxRuns.get(inputs.sources);
		return done === undefined ? syntaxHalf(inputs) : Effect.succeed(done);
	});
	return Effect.flatMap(syntax, (found) =>
		Effect.map(
			eachGroup(inputs, (sources, workspace) => everyFinding({ ...inputs, sources }, workspace)),
			(every) => without(every, found),
		),
	);
}

export const effectBoundary = defineRule({
	check: syntaxHalf,
	deepHalf: { check: typedHalf, name: "typed half" },
	description:
		"Use Effect instead of Promise syntax and parameters, Effect.promise or Effect.tryPromise bridges to an imported outside library, synchronous Node IO, throwing helper calls or Effect.sync with throwing APIs. Runners belong at entry points (including main.tsx and entry.tsx), tool configs and tests. Within Effect code, adapters/ and test-support/ folders and tool configs directly in a package's folder, which their tool loads from that fixed path, are exempt; calls to throwing helpers defined in adapters/ are accepted. Use Effect services and tagged errors; move what a library forces into a module under adapters/ that returns an Effect. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/boundary",
	registrable: false,
});
