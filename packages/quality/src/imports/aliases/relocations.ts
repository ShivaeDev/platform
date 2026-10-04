import { realpathSync } from "node:fs";
import { posix } from "node:path";
import type ts from "typescript";
import type { RuleInputs } from "../../rule.ts";
import { parse } from "../../rules/syntax.ts";
import { projectsFor } from "../projects.ts";
import { type Endpoint, resolveImport } from "../resolve.ts";
import { type SpecifierSite, specifierSites } from "../specifiers.ts";
import { workspacePackages } from "../workspace.ts";
import { chooseAlias } from "./choose.ts";
import { type AliasScopes, aliasScopes } from "./scope.ts";

export interface Relocation extends SpecifierSite {
	readonly file: string;
	readonly replacement: string | undefined;
	readonly target: Endpoint | undefined;
}

const QUERY = /\?.*$/u;

const RELATIVE = /^\.\.?(?:\/|$)/u;

const MAY_BE_RELATIVE = /["'`]\.\.?[/"'`]/u;

const TRAILING_SLASHES = /\/+$/u;

const INDEX = "index.";

function noAmbient(): boolean {
	return false;
}

function leavesLexically(path: string): boolean {
	const normal = posix.normalize(path).replace(TRAILING_SLASHES, "");
	return normal === ".." || normal.startsWith("../") || normal.includes("/");
}

function withoutExtension(path: string): string {
	const extension = posix.extname(path);
	return extension === "" ? path : path.slice(0, -extension.length);
}

// The spelled path comes first, so an alias keeps the extension, or its absence, that the import had.
function subjectsOf(spelled: string, target: string): readonly string[] {
	const index = posix.basename(target).startsWith(INDEX) ? [posix.dirname(target)] : [];
	return [...new Set([spelled, target, withoutExtension(target), ...index])];
}

interface FileContext {
	readonly from: string;
	readonly options: ts.CompilerOptions;
	readonly path: string;
	readonly resolve: (site: SpecifierSite, specifier: string) => Endpoint | undefined;
}

async function relocationOf(context: FileContext, scopes: AliasScopes, site: SpecifierSite, root: string): Promise<Relocation | undefined> {
	const path = site.specifier.replace(QUERY, "");
	if (!RELATIVE.test(path)) {
		return undefined;
	}
	const target = context.resolve(site, site.specifier);
	const local = target?.kind === "file" ? target.path : undefined;
	if (!(leavesLexically(path) || (local !== undefined && posix.dirname(local) !== posix.dirname(context.path)))) {
		return undefined;
	}
	const relocation = { ...site, file: context.path, replacement: undefined, target };
	if (local === undefined) {
		return relocation;
	}
	const query = site.specifier.slice(path.length);
	const scope = await scopes(context.path, local, context.options);
	const subjects = subjectsOf(posix.join(posix.dirname(context.from), path), posix.join(root, local));
	const alias = chooseAlias(scope, subjects, (candidate) => {
		const reached = context.resolve(site, `${candidate}${query}`);
		return reached?.kind === "file" && reached.path === local;
	});
	return { ...relocation, replacement: alias === undefined ? undefined : `${alias}${query}` };
}

export async function relocations(inputs: RuleInputs): Promise<readonly Relocation[]> {
	const root = realpathSync(inputs.root);
	const projectOf = projectsFor(root);
	const scopes = aliasScopes(inputs, root, await workspacePackages(inputs));
	const found: Relocation[] = [];
	for (const file of inputs.sources) {
		const syntax = MAY_BE_RELATIVE.test(file.text) ? parse(file) : undefined;
		if (syntax === undefined) {
			continue;
		}
		const from = posix.join(root, file.path);
		const project = projectOf(from);
		function resolve(site: SpecifierSite, specifier: string): Endpoint | undefined {
			return resolveImport(root, noAmbient, { kind: "import", line: site.line, specifier, type: site.type }, from, project);
		}
		const context = { from, options: project.options, path: file.path, resolve };
		for (const site of specifierSites(syntax)) {
			const relocation = await relocationOf(context, scopes, site, root);
			found.push(...(relocation === undefined ? [] : [relocation]));
		}
	}
	return found;
}
