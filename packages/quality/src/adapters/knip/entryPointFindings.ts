import { join, posix } from "node:path";
import { ambientModules } from "#imports/ambient.ts";
import { importGraph } from "#imports/graph.ts";
import { isTooling } from "#imports/isTooling.ts";
import { projectsFor } from "#imports/projects.ts";
import { packageOf } from "#imports/workspace.ts";
import { entryPointsOf, isApplication, provider } from "#manifests/entryPoints.ts";
import { isTestCode } from "#naming/testName.ts";
import type { Findings, RuleInputs } from "#rule.ts";
import { parse } from "#rules/parse.ts";

export async function entryPointFindings(inputs: RuleInputs, findings: Findings): Promise<Findings> {
	const graph = await importGraph(inputs);
	const projectOf = projectsFor(inputs.root);
	const ambient = ambientModules(
		inputs.sources.flatMap((file) => {
			const syntax = parse(file);
			return syntax === undefined ? [] : [{ path: join(inputs.root, file.path), syntax }];
		}),
	);
	const unusedFiles = new Set(findings.filter((finding) => finding.subject?.startsWith("files:")).map((finding) => finding.file));
	const workspace = new Map(graph.packages.map(({ name, directory }) => [name, directory]));
	const directories = [".", ...graph.packages.map(({ directory }) => directory)];
	const policies = new Map(
		await Promise.all(
			directories.map(async (directory) => {
				const manifest: unknown = JSON.parse((await inputs.readText(posix.join(directory, "package.json"))) ?? "{}");
				return [directory, isApplication(manifest) ? await entryPointsOf(inputs, directory, manifest, workspace) : []] as const;
			}),
		),
	);
	function owner(path: string) {
		return packageOf(graph.packages, path)?.directory ?? ".";
	}
	function development(directory: string, path: string) {
		return isTestCode(path) || isTooling(directory, path);
	}
	return findings.filter((finding) => {
		const [kind, name] = finding.subject?.split(":") ?? [];
		if (name === undefined) {
			return true;
		}
		const directory = owner(finding.file);
		const entries = policies.get(directory) ?? [];
		if (kind === "unlisted") {
			return (
				!ambient(name, projectOf(join(inputs.root, finding.file)).files)
				&& provider(entries, name, development(directory, finding.file), true) === undefined
			);
		}
		if (kind !== "dependencies" && kind !== "devDependencies") {
			return true;
		}
		return ![...graph.edges, ...graph.unresolved].some((edge) => {
			if (owner(edge.from) !== directory || unusedFiles.has(edge.from)) {
				return false;
			}
			const target = /^[.#/]/u.test(edge.specifier)
				? undefined
				: edge.specifier
						.split("/")
						.slice(0, edge.specifier.startsWith("@") ? 2 : 1)
						.join("/");
			return target !== undefined && provider(entries, target, development(directory, edge.from), true)?.name === name;
		});
	});
}
