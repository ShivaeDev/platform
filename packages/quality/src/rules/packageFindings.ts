import { Deferred, Effect, Result } from "effect";
import { changeKeyCheck } from "#adapters/changeKeyCheck.ts";
import { contextCaptureCheck } from "#adapters/contextCaptureCheck.ts";
import { projectsFor } from "#adapters/imports/projects.ts";
import { nativeTransactionCheck } from "#adapters/nativeTransactionCheck.ts";
import { rpcBoundaryCheck } from "#adapters/rpcBoundaryCheck.ts";
import { serviceModelCheck } from "#adapters/serviceModelCheck.ts";
import { sharedErrorCheck } from "#adapters/sharedErrorCheck.ts";
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
	{ id: "effect/context-capture", prepare: contextCaptureCheck },
	{ id: "effect/rpc-boundary", prepare: rpcBoundaryCheck },
	{ id: "effect/service-model", prepare: serviceModelCheck },
	{ id: "effect/service-parameters", prepare: serviceParameterCheck },
	{ id: "effect/shared-error-classes", prepare: sharedErrorCheck },
	{ id: "effect/sql-transact", prepare: nativeTransactionCheck },
	{ id: "suppressions/no-double-cast", prepare: typedCastCheck },
] as const;

type CheckId = (typeof CHECKS)[number]["id"];
type Prepared = ReturnType<(typeof CHECKS)[number]["prepare"]>;
type Checked = ReadonlyMap<CheckId, Result.Result<readonly Finding[], Effect.Error<Prepared>>>;

function messageOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

// One program per package serves every check and is dropped before the next package, so memory stays bounded by the largest package.
const walk = Effect.fn("PackageChecks.walk")(function* (inputs: RuleInputs) {
	const prepared = yield* Effect.forEach(CHECKS, ({ id, prepare }) =>
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

type Walk = ReturnType<typeof walk>;
const walks = new WeakMap<readonly SourceFile[], Deferred.Deferred<Checked, Effect.Error<Walk>>>();

// The first type-checking rule of a scan walks the packages for all of them; the others wait for its results.
export function packageFindings(inputs: RuleInputs, id: CheckId): Effect.Effect<readonly Finding[], unknown, Effect.Services<Walk>> {
	return Effect.suspend(() => {
		const known = walks.get(inputs.sources);
		if (known !== undefined) {
			return Deferred.await(known);
		}
		const walked = Deferred.makeUnsafe<Checked, Effect.Error<Walk>>();
		walks.set(inputs.sources, walked);
		return Effect.andThen(Deferred.into(walk(inputs), walked), Deferred.await(walked));
	}).pipe(Effect.flatMap((checked) => Effect.fromResult(checked.get(id) ?? Result.succeed([]))));
}
