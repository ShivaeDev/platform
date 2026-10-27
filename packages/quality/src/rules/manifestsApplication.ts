import { dirname, posix, relative, resolve, sep } from "node:path";
import { pnpmWorkspaceList } from "#imports/pnpmWorkspacePatterns.ts";
import { workspacePackages } from "#imports/workspace.ts";
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

function ancestors(root: string, directory: string): readonly string[] {
	const start = resolve(root, directory);
	const parent = dirname(start);
	return parent === start ? [start] : [start, ...ancestors(root, relative(root, parent))];
}

async function nearestWorkspace(inputs: Pick<RuleInputs, "readText" | "root">, directory: string) {
	for (const candidate of ancestors(inputs.root, directory)) {
		const path = posix.join(relative(inputs.root, candidate).split(sep).join("/") || ".", "pnpm-workspace.yaml");
		const text = await inputs.readText(path);
		if (text !== undefined) {
			return { path, text };
		}
	}
	return undefined;
}

async function hoistFindings(inputs: Pick<RuleInputs, "readText" | "root">, manifestPath: string, directory: string): Promise<readonly Finding[]> {
	const workspace = await nearestWorkspace(inputs, directory);
	const target = workspace?.path ?? posix.join(directory, "pnpm-workspace.yaml");
	const repair = `Add \`${HOIST_LINE}\` to ${target} so the pieces platform brings resolve by their own names.`;
	if (workspace === undefined) {
		return [{ file: manifestPath, message: `Depends on "${PLATFORM}" without a pnpm-workspace.yaml. ${repair}`, subject: HOIST_KEY }];
	}
	let patterns: readonly string[];
	try {
		patterns = pnpmWorkspaceList(workspace.text, HOIST_KEY);
	} catch (cause) {
		return [{ file: workspace.path, message: `${cause instanceof Error ? cause.message : String(cause)}. Write ${HOIST_LINE}.`, subject: HOIST_KEY }];
	}
	const included = patterns.some((pattern) => !pattern.startsWith("!") && hoists(pattern));
	const excluded = patterns.some((pattern) => pattern.startsWith("!") && hoists(pattern.slice(1)));
	if (included && !excluded) {
		return [];
	}
	return [
		{ file: manifestPath, message: `Depends on "${PLATFORM}", but ${workspace.path} does not hoist ${HOISTED}. ${repair}`, subject: HOIST_KEY },
	];
}

async function duplicateFindings(
	inputs: Pick<RuleInputs, "readText">,
	manifestPath: string,
	directory: string,
	manifest: unknown,
	workspace: ReadonlyMap<string, string>,
): Promise<readonly Finding[]> {
	const entryPoints = (await entryPointsOf(inputs, directory, manifest, workspace)).filter((entry) => entry.declared !== undefined);
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
}

export const manifestsApplication = defineRule({
	check: async (inputs) => {
		const packages = await workspacePackages(inputs);
		const workspace = new Map(packages.map((owner) => [owner.name, owner.directory]));
		const directories = [".", ...packages.map((owner) => owner.directory)];
		const findings = await Promise.all(
			directories.map(async (directory) => {
				const manifestPath = posix.join(directory, "package.json");
				const manifest = parsed(await inputs.readText(manifestPath));
				if (!isApplication(manifest)) {
					return [];
				}
				return [
					...(await hoistFindings(inputs, manifestPath, directory)),
					...(await duplicateFindings(inputs, manifestPath, directory, manifest, workspace)),
				];
			}),
		);
		return findings.flat();
	},
	description: `An application, a package that depends on ${PLATFORM}, hoists ${HOISTED} in its nearest pnpm-workspace.yaml and lists no package beside the entry point that already brings it.`,
	id: "manifests/application",
});
