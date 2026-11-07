import { realpathSync } from "node:fs";
import { posix } from "node:path";
import { type Project, projectsFor } from "#adapters/imports/projects.ts";
import { resolveImport } from "#adapters/imports/resolve.ts";
import type { Departure } from "#imports/departures.ts";
import type { ImportRequest } from "#imports/extract.ts";
import { type SpecifierSite, specifierSites } from "#imports/specifiers.ts";
import { packageOf, type WorkspacePackage } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";
import { parse } from "#rules/parse.ts";

const QUERY = /\?.*$/u;

const RELATIVE = /^\.\.?(?:\/|$)/u;

const MAY_BE_RELATIVE = /["'`]\.\.?[/"'`]|\\/u;

function noAmbient(): boolean {
	return false;
}

interface FileContext {
	readonly from: string;
	readonly packages: readonly WorkspacePackage[];
	readonly path: string;
	readonly project: Project;
	readonly root: string;
}

function departureAt(context: FileContext, site: SpecifierSite): Departure | undefined {
	const path = site.specifier.replace(QUERY, "");
	if (!RELATIVE.test(path)) {
		return undefined;
	}
	const request: ImportRequest = { kind: "import", line: site.line, specifier: site.specifier, type: site.type };
	const target = resolveImport(context.root, noAmbient, request, context.from, context.project);
	const local = target?.kind === "file" ? target.path : undefined;
	const owner = local === undefined ? undefined : packageOf(context.packages, local);
	const workspace = owner !== undefined && owner !== packageOf(context.packages, context.path) ? owner.name : undefined;
	return { ...site, file: context.path, installed: target?.kind === "external" ? target.package : undefined, workspace };
}

export function departures(inputs: RuleInputs, packages: readonly WorkspacePackage[]): readonly Departure[] {
	const root = realpathSync(inputs.root);
	const projectOf = projectsFor(root);
	return inputs.sources.flatMap((file) => {
		const syntax = MAY_BE_RELATIVE.test(file.text) ? parse(file) : undefined;
		if (syntax === undefined) {
			return [];
		}
		const from = posix.join(root, file.path);
		const context = { from, packages, path: file.path, project: projectOf(from), root };
		return specifierSites(syntax).flatMap((site) => departureAt(context, site) ?? []);
	});
}
