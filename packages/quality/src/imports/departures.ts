import { realpathSync } from "node:fs";
import { posix } from "node:path";
import { moduleRoot } from "#naming/moduleRoot.ts";
import type { RuleInputs } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import type { ImportRequest } from "./extract.ts";
import { type Project, projectsFor } from "./projects.ts";
import { resolveImport } from "./resolve.ts";
import { type SpecifierSite, specifierSites } from "./specifiers.ts";
import { packageOf, type WorkspacePackage, workspacePackages } from "./workspace.ts";

export interface Departure extends SpecifierSite {
	readonly file: string;
	readonly installed: string | undefined;
	readonly workspace: string | undefined;
}

const QUERY = /\?.*$/u;

const RELATIVE = /^\.\.?(?:\/|$)/u;

const MAY_BE_RELATIVE = /["'`]\.\.?[/"'`]|\\/u;

const TRAILING_SLASHES = /\/+$/u;

function noAmbient(): boolean {
	return false;
}

function leavesLexically(path: string): boolean {
	const normal = posix.normalize(path).replace(TRAILING_SLASHES, "");
	return normal === ".." || normal.startsWith("../") || normal.includes("/");
}

interface FileContext {
	readonly from: string;
	readonly packages: readonly WorkspacePackage[];
	readonly path: string;
	readonly project: Project;
	readonly root: string;
}

function registersAdmin(from: string, specifier: string, target: string | undefined): boolean {
	const root = moduleRoot(from);
	const folder = posix.dirname(from);
	return (
		root !== undefined
		&& (folder === `${root}/client` || folder === `${root}/server`)
		&& /^registration\.[cm]?[jt]sx?$/u.test(posix.basename(from))
		&& specifier.startsWith("./admin/")
		&& target?.startsWith(`${folder}/admin/`) === true
	);
}

// A relative import leaves its folder when its path climbs or descends, or when it names a folder whose index file lies below.
function departureAt(context: FileContext, site: SpecifierSite): Departure | undefined {
	const path = site.specifier.replace(QUERY, "");
	if (!RELATIVE.test(path)) {
		return undefined;
	}
	const request: ImportRequest = { kind: "import", line: site.line, specifier: site.specifier, type: site.type };
	const target = resolveImport(context.root, noAmbient, request, context.from, context.project);
	const local = target?.kind === "file" ? target.path : undefined;
	if (registersAdmin(context.path, path, local)) {
		return undefined;
	}
	if (!(leavesLexically(path) || (local !== undefined && posix.dirname(local) !== posix.dirname(context.path)))) {
		return undefined;
	}
	const owner = local === undefined ? undefined : packageOf(context.packages, local);
	const workspace = owner !== undefined && owner !== packageOf(context.packages, context.path) ? owner.name : undefined;
	return { ...site, file: context.path, installed: target?.kind === "external" ? target.package : undefined, workspace };
}

export async function departures(inputs: RuleInputs): Promise<readonly Departure[]> {
	const root = realpathSync(inputs.root);
	const projectOf = projectsFor(root);
	const packages = await workspacePackages(inputs);
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
