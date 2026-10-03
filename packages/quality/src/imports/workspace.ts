import { posix } from "node:path";
import type { RuleInputs } from "../rule.ts";
import { globMatches } from "./glob.ts";
import { pnpmWorkspacePatterns } from "./pnpm-workspace.ts";

export interface WorkspacePackage {
	readonly directory: string;
	readonly name: string;
}

type Reader = Pick<RuleInputs, "files" | "readText">;

const MANIFEST = "package.json";

const PNPM_WORKSPACE = "pnpm-workspace.yaml";

const NEGATION = "!";

const LEADING_DOT = /^\.\//u;

const TRAILING_SLASHES = /\/+$/u;

function parsed(text: string | undefined): unknown {
	if (text === undefined) {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function field(value: unknown, key: string): unknown {
	return typeof value === "object" && value !== null && key in value ? Reflect.get(value, key) : undefined;
}

function strings(value: unknown): readonly string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function npmPatterns(text: string | undefined): readonly string[] {
	const workspaces = field(parsed(text), "workspaces");
	return Array.isArray(workspaces) ? strings(workspaces) : strings(field(workspaces, "packages"));
}

function normalized(pattern: string): string {
	return pattern.replace(LEADING_DOT, "").replace(TRAILING_SLASHES, "");
}

async function memberOf(inputs: Reader): Promise<(directory: string) => boolean> {
	const pnpm = await inputs.readText(PNPM_WORKSPACE);
	const patterns = [...(pnpm === undefined ? [] : pnpmWorkspacePatterns(pnpm)), ...npmPatterns(await inputs.readText(MANIFEST))];
	const included = patterns.filter((pattern) => !pattern.startsWith(NEGATION)).map(normalized);
	const excluded = patterns.filter((pattern) => pattern.startsWith(NEGATION)).map((pattern) => normalized(pattern.slice(NEGATION.length)));
	return (directory) => included.some((pattern) => globMatches(pattern, directory)) && !excluded.some((pattern) => globMatches(pattern, directory));
}

export async function workspacePackages(inputs: Reader): Promise<readonly WorkspacePackage[]> {
	const member = await memberOf(inputs);
	const directories = inputs.files
		.filter((file) => posix.basename(file) === MANIFEST && file !== MANIFEST)
		.map((manifest) => posix.dirname(manifest))
		.filter(member);
	const named = await Promise.all(
		directories.map(async (directory) => ({ directory, name: field(parsed(await inputs.readText(posix.join(directory, MANIFEST))), "name") })),
	);
	return named.flatMap(({ directory, name }) => (typeof name === "string" ? [{ directory, name }] : []));
}

export function packageOf(packages: readonly WorkspacePackage[], path: string): WorkspacePackage | undefined {
	const owners = packages.filter((candidate) => path.startsWith(`${candidate.directory}/`));
	return owners.toSorted((left, right) => right.directory.length - left.directory.length)[0];
}
