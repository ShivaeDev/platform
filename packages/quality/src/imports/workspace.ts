import { posix } from "node:path";
import { Effect } from "effect";
import { manifestFiles, readPackageManifest } from "#adapters/manifestInventory.ts";
import { globMatcher } from "#imports/globMatcher.ts";
import { pnpmWorkspacePatterns } from "#imports/pnpmWorkspacePatterns.ts";
import type { RuleInputs } from "#rule.ts";

export interface WorkspacePackage {
	readonly directory: string;
	readonly name: string;
}

type Reader = Pick<RuleInputs, "files" | "readText"> & Partial<Pick<RuleInputs, "root">>;

const MANIFEST = "package.json";

const PNPM_WORKSPACE = "pnpm-workspace.yaml";

const NEGATION = "!";

const LEADING_DOT = /^\.\//u;

const TRAILING_SLASHES = /\/+$/u;

function field(value: unknown, key: string): unknown {
	return typeof value === "object" && value !== null && key in value ? Reflect.get(value, key) : undefined;
}

function strings(value: unknown): readonly string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function npmPatterns(manifest: unknown): readonly string[] {
	const workspaces = field(manifest, "workspaces");
	return Array.isArray(workspaces) ? strings(workspaces) : strings(field(workspaces, "packages"));
}

function normalized(pattern: string): string {
	return pattern.replace(LEADING_DOT, "").replace(TRAILING_SLASHES, "");
}

function matchers(patterns: readonly string[]) {
	return Effect.forEach(patterns, (pattern) => Effect.fromResult(globMatcher(pattern)));
}

const memberOf = Effect.fn("Imports.memberOf")(function* (inputs: Reader) {
	const pnpm = yield* inputs.readText(PNPM_WORKSPACE);
	const patterns = [
		...(pnpm === undefined ? [] : pnpmWorkspacePatterns(pnpm)),
		...npmPatterns(yield* readPackageManifest(inputs.readText, MANIFEST)),
	];
	const included = yield* matchers(patterns.filter((pattern) => !pattern.startsWith(NEGATION)).map(normalized));
	const excluded = yield* matchers(
		patterns.filter((pattern) => pattern.startsWith(NEGATION)).map((pattern) => normalized(pattern.slice(NEGATION.length))),
	);
	return (directory: string) => included.some((matches) => matches(directory)) && !excluded.some((matches) => matches(directory));
});

export const workspacePackages = Effect.fn("Imports.workspacePackages")(function* (inputs: Reader) {
	const member = yield* memberOf(inputs);
	const manifests = manifestFiles(inputs);
	const directories = manifests
		.filter((file) => posix.basename(file) === MANIFEST && file !== MANIFEST)
		.map((manifest) => posix.dirname(manifest))
		.filter(member);
	const named = yield* Effect.forEach(
		directories,
		(directory) =>
			Effect.map(readPackageManifest(inputs.readText, posix.join(directory, MANIFEST)), (manifest) => ({ directory, name: field(manifest, "name") })),
		{ concurrency: "unbounded" },
	);
	return named.flatMap(({ directory, name }): readonly WorkspacePackage[] => (typeof name === "string" ? [{ directory, name }] : []));
});

export function packageOf(packages: readonly WorkspacePackage[], path: string): WorkspacePackage | undefined {
	const owners = packages.filter((candidate) => path.startsWith(`${candidate.directory}/`));
	return owners.toSorted((left, right) => right.directory.length - left.directory.length)[0];
}
