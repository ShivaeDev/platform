import { dirname, posix, relative, resolve, sep } from "node:path";
import { Effect, Result } from "effect";
import { pnpmWorkspaceList } from "#imports/pnpmWorkspacePatterns.ts";
import { workspacePackages } from "#imports/workspace.ts";
import type { FilesystemFailure } from "#inventory/filesystem.ts";
import { type ManifestReadFailure, readPackageManifest } from "#manifestInventory.ts";
import { DEPENDENCY_FIELDS, dependencyNames, entryPointsOf, isApplication, PLATFORM } from "#manifests/entryPoints.ts";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";

const HOISTED = "@shivaedev/*";

const HOIST_KEY = "publicHoistPattern";

const HOIST_LINE = `${HOIST_KEY}: ["${HOISTED}"]`;

const PROBE = "@shivaedev/probe";

function hoists(pattern: string): boolean {
	const source = pattern.replaceAll(/[.+?^${}()|[\]\\]/gu, "\\$&").replaceAll("*", ".*");
	return new RegExp(`^${source}$`, "u").test(PROBE);
}

function ancestors(root: string, directory: string): readonly string[] {
	const start = resolve(root, directory);
	const parent = dirname(start);
	return parent === start ? [start] : [start, ...ancestors(root, relative(root, parent))];
}

const nearestWorkspace = Effect.fn("Manifests.nearestWorkspace")(function* (inputs: Pick<RuleInputs, "readText" | "root">, directory: string) {
	for (const candidate of ancestors(inputs.root, directory)) {
		const path = posix.join(relative(inputs.root, candidate).split(sep).join("/") || ".", "pnpm-workspace.yaml");
		const text = yield* inputs.readText(path);
		if (text !== undefined) {
			return { path, text };
		}
	}
	return undefined;
});

const hoistFindings = Effect.fn("Manifests.hoistFindings")(function* (
	inputs: Pick<RuleInputs, "readText" | "root">,
	manifestPath: string,
	directory: string,
): Effect.fn.Return<readonly Finding[], FilesystemFailure> {
	const workspace = yield* nearestWorkspace(inputs, directory);
	const target = workspace?.path ?? posix.join(directory, "pnpm-workspace.yaml");
	const repair = `Add \`${HOIST_LINE}\` to ${target} so the pieces platform brings resolve by their own names.`;
	if (workspace === undefined) {
		return [{ file: manifestPath, message: `Depends on "${PLATFORM}" without a pnpm-workspace.yaml. ${repair}`, subject: HOIST_KEY }];
	}
	const parsed = pnpmWorkspaceList(workspace.text, HOIST_KEY);
	if (Result.isFailure(parsed)) {
		return [{ file: workspace.path, message: `${parsed.failure.message}. Write ${HOIST_LINE}.`, subject: HOIST_KEY }];
	}
	const patterns = parsed.success;
	const included = patterns.some((pattern) => !pattern.startsWith("!") && hoists(pattern));
	const excluded = patterns.some((pattern) => pattern.startsWith("!") && hoists(pattern.slice(1)));
	if (included && !excluded) {
		return [];
	}
	return [
		{ file: manifestPath, message: `Depends on "${PLATFORM}", but ${workspace.path} does not hoist ${HOISTED}. ${repair}`, subject: HOIST_KEY },
	];
});

const duplicateFindings = Effect.fn("Manifests.duplicateFindings")(function* (
	inputs: Pick<RuleInputs, "readText">,
	manifestPath: string,
	directory: string,
	manifest: unknown,
	workspace: ReadonlyMap<string, string>,
): Effect.fn.Return<readonly Finding[], ManifestReadFailure> {
	const entryPoints = (yield* entryPointsOf(inputs, directory, manifest, workspace)).filter((entry) => entry.declared !== undefined);
	return DEPENDENCY_FIELDS.flatMap((field) =>
		dependencyNames(manifest, field).flatMap((name) => {
			const entry = entryPoints.find((candidate) => candidate.provides.has(name));
			return entry === undefined
				? []
				: [
						{
							file: manifestPath,
							message: `Lists "${name}" in ${field} beside "${entry.name}", which already brings it. Remove "${name}" from ${field} and keep importing it by its own name.`,
							subject: name,
						},
					];
		}),
	);
});

export const manifestsApplication = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const packages = yield* workspacePackages(inputs);
			const workspace = new Map(packages.map((owner) => [owner.name, owner.directory]));
			const directories = [".", ...packages.map((owner) => owner.directory)];
			const findings = yield* Effect.forEach(
				directories,
				(directory) =>
					Effect.gen(function* () {
						const manifestPath = posix.join(directory, "package.json");
						const manifest = yield* readPackageManifest(inputs.readText, manifestPath);
						if (!isApplication(manifest)) {
							return [];
						}
						return [
							...(yield* hoistFindings(inputs, manifestPath, directory)),
							...(yield* duplicateFindings(inputs, manifestPath, directory, manifest, workspace)),
						];
					}),
				{ concurrency: "unbounded" },
			);
			return findings.flat();
		}),
	description: `An application, a package that depends on ${PLATFORM}, hoists ${HOISTED} in its nearest pnpm-workspace.yaml and lists no package beside the entry point that already brings it.`,
	id: "manifests/application",
});
