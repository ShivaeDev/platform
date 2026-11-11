import { Deferred, Effect, Layer, Result } from "effect";
import { changeKeyCheck } from "#adapters/changeKeyCheck.ts";
import { DeclarationFiles } from "#adapters/declaration-files/service.ts";
import { projectsFor } from "#adapters/imports/projects.ts";
import { sourcesProgram } from "#adapters/typeScriptProgram.ts";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import type { Finding, RuleInputs, SourceFile, TypeScriptProgram } from "#rule.ts";
import { serviceParameterCheck } from "#rules/effect/serviceParameterCheck.ts";
import { typedCastCheck } from "#rules/suppressions/typedCastCheck.ts";

export interface PackageCheck {
	readonly checks: (file: SourceFile) => boolean;
	readonly findings: (files: readonly SourceFile[], typeScript: TypeScriptProgram) => readonly Finding[];
}

const CHECKS = [
	{ id: "boundaries/imported-change-keys", prepare: changeKeyCheck },
	{ id: "effect/service-parameters", prepare: serviceParameterCheck },
	{ id: "suppressions/no-double-cast", prepare: typedCastCheck },
] as const;

type CheckId = (typeof CHECKS)[number]["id"];

export const PACKAGE_CHECKS: ReadonlySet<string> = new Set(CHECKS.map(({ id }) => id));
type Prepared = ReturnType<(typeof CHECKS)[number]["prepare"]>;
type Checked = ReadonlyMap<CheckId, Result.Result<readonly Finding[], Effect.Error<Prepared>>>;

function messageOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

// One program per package serves every check and is dropped before the next package, so memory stays bounded by the largest package.
// The walk parses installed declarations into its own registry, not the run's memoized one, so they are released with it; later rules parse again the few they read.
const walk = Effect.fn("PackageChecks.walk")(function* (inputs: RuleInputs, ids: ReadonlySet<string>) {
	const prepared = yield* Effect.forEach(
		CHECKS.filter(({ id }) => ids.has(id)),
		({ id, prepare }) =>
			Effect.map(Effect.result<PackageCheck, Effect.Error<Prepared>, Effect.Services<Prepared>>(prepare(inputs)), (result) => [id, result] as const),
	);
	const ready = prepared.flatMap(([id, result]) => (Result.isSuccess(result) ? [[id, result.success] as const] : []));
	const packages = yield* workspacePackages(inputs);
	const groups = new Map<string, SourceFile[]>();
	for (const source of inputs.sources) {
		const directory = packageOf(packages, source.path)?.directory ?? ".";
		const files = groups.get(directory) ?? [];
		files.push(source);
		groups.set(directory, files);
	}
	const projectOf = projectsFor(inputs.root);
	const found = new Map<CheckId, Finding[]>(ready.map(([id]) => [id, []]));
	for (const [directory, files] of groups) {
		const selected = ready.map(([id, check]) => ({ check, files: files.filter(check.checks), id })).filter((entry) => entry.files.length > 0);
		if (selected.length === 0) {
			continue;
		}
		const typeScript = yield* sourcesProgram(
			inputs.root,
			files.filter((file) => selected.some((entry) => entry.files.includes(file))),
			projectOf,
		);
		for (const { check, files: chosen, id } of selected) {
			const findings = yield* Effect.sync(() => check.findings(chosen, typeScript)).pipe(
				Effect.catchDefect((cause) => Effect.die(new Error(`${id} failed in ${directory}: ${messageOf(cause)}`, { cause }))),
			);
			found.get(id)?.push(...findings);
		}
	}
	const checked: Checked = new Map(
		prepared.map(([id, result]) => [id, Result.isSuccess(result) ? Result.succeed(found.get(id) ?? []) : Result.fail(result.failure)]),
	);
	return checked;
});

function walkPackages(inputs: RuleInputs, ids: ReadonlySet<string>) {
	return walk(inputs, ids).pipe(Effect.provide(Layer.fresh(DeclarationFiles.layer)));
}

type Walk = ReturnType<typeof walkPackages>;
const walks = new WeakMap<readonly SourceFile[], Deferred.Deferred<Checked, Effect.Error<Walk>>>();

// A run walks the packages once for the checks of its active rules. Those rules wait for the walk outside the rule pool, and the run decides when the walk itself runs.
export function withPackageWalk<TValue, TError, TServices>(
	inputs: RuleInputs,
	ids: ReadonlySet<string>,
	use: (walked: Effect.Effect<void, never, Effect.Services<Walk>>) => Effect.Effect<TValue, TError, TServices>,
): Effect.Effect<TValue, TError, TServices> {
	return Effect.acquireUseRelease(
		Effect.sync(() => {
			const walked = Deferred.makeUnsafe<Checked, Effect.Error<Walk>>();
			walks.set(inputs.sources, walked);
			return walked;
		}),
		(walked) => use(Effect.asVoid(Deferred.into(walkPackages(inputs, ids), walked))),
		() => Effect.sync(() => walks.delete(inputs.sources)),
	);
}

export function packageFindings(inputs: RuleInputs, id: CheckId): Effect.Effect<readonly Finding[], unknown, Effect.Services<Walk>> {
	return Effect.suspend(() => {
		const walked = walks.get(inputs.sources);
		return walked === undefined ? walkPackages(inputs, new Set([id])) : Deferred.await(walked);
	}).pipe(Effect.flatMap((checked) => Effect.fromResult(checked.get(id) ?? Result.succeed([]))));
}
