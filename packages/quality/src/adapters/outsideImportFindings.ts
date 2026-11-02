import ts from "typescript";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { importGraph } from "#imports/graph.ts";
import { packageNameOf } from "#imports/packageName.ts";
import { packageOf } from "#imports/workspace.ts";
import type { Finding, RuleInputs } from "#rule.ts";
import { parse } from "#rules/parse.ts";

function onlyInlineTypes(statement: ts.Statement): boolean {
	if (ts.isImportDeclaration(statement)) {
		const clause = statement.importClause;
		const bindings = clause?.namedBindings;
		return (
			clause?.name === undefined
			&& bindings !== undefined
			&& ts.isNamedImports(bindings)
			&& bindings.elements.length > 0
			&& bindings.elements.every((item) => item.isTypeOnly)
		);
	}
	const exports = ts.isExportDeclaration(statement) ? statement.exportClause : undefined;
	return exports !== undefined && ts.isNamedExports(exports) && exports.elements.length > 0 && exports.elements.every((item) => item.isTypeOnly);
}

function inlineTypes(inputs: RuleInputs): ReadonlySet<string> {
	const sites = new Set<string>();
	for (const file of inputs.sources) {
		const source = parse(file);
		if (source === undefined) {
			continue;
		}
		for (const statement of source.statements.filter(onlyInlineTypes)) {
			sites.add(`${file.path}:${source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1}`);
		}
	}
	return sites;
}

function exempt(path: string, name: string): boolean {
	return (
		/(?:^|\/)(?:adapters|test-support)\//u.test(path)
		|| name === "effect"
		|| name.startsWith("@effect/")
		|| name.startsWith("@shivaedev/")
		|| ((name === "react" || name === "react-dom") && /(?:^|\/)client\//u.test(path))
	);
}

export async function outsideImportFindings(inputs: RuleInputs): Promise<readonly Finding[]> {
	const graph = await importGraph(inputs);
	const owners = [...graph.packages.map((owner) => owner.directory), "."];
	const runtime = new Map(
		await Promise.all(
			owners.map(async (directory) => {
				const manifest = await readPackageManifest(inputs.readText, `${directory}/package.json`);
				return [
					directory,
					new Set(Object.keys({ ...manifest?.dependencies, ...manifest?.peerDependencies, ...manifest?.optionalDependencies })),
				] as const;
			}),
		),
	);
	const types = inlineTypes(inputs);
	const workspace = new Set(graph.packages.map((owner) => owner.name));
	const sites = [
		...graph.edges.flatMap((edge) => (edge.to.kind === "external" ? [{ ...edge, name: edge.to.package }] : [])),
		...graph.unresolved
			.filter((edge) => edge.missing === undefined && !/^[.#/]/u.test(edge.specifier))
			.map((edge) => ({ ...edge, name: packageNameOf(edge.specifier) })),
	];
	return sites.flatMap((site) => {
		const directory = packageOf(graph.packages, site.from)?.directory ?? ".";
		if (
			workspace.has(site.name)
			|| site.type
			|| site.kind !== "import"
			|| types.has(`${site.from}:${site.line}`)
			|| exempt(site.from, site.name)
			|| !(site.name.startsWith("node:") || runtime.get(directory)?.has(site.name))
		) {
			return [];
		}
		return [
			{
				file: site.from,
				line: site.line,
				message: `Imports outside library "${site.specifier}" as a value. Move the integration into an adapters/ folder and expose Effect values; use import type for types.`,
			},
		];
	});
}
