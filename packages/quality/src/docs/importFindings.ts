import { Effect } from "effect";
import { type DocumentedImport, documentedImports } from "#docs/documentedImports.ts";
import { type DocumentedModule, documentedModule } from "#docs/documentedModule.ts";
import { exportsName } from "#docs/exportsName.ts";
import { packageNameOf } from "#imports/packageName.ts";
import type { WorkspacePackage } from "#imports/workspace.ts";
import type { FilesystemFailure } from "#inventory/filesystem.ts";
import type { Finding, RuleInputs } from "#rule.ts";

export interface ImportContext {
	readonly exports: ReadonlyMap<string, unknown>;
	readonly generated: readonly string[];
	readonly owner: string | undefined;
	readonly packages: ReadonlyMap<string, WorkspacePackage>;
	readonly readText: RuleInputs["readText"];
	readonly root: string;
}

function missingExport(specifier: string, path: string, name: string): string {
	return name === "default"
		? `"${specifier}" has no default export. Import a named export of ${path}, or the module whose default export you mean.`
		: `"${specifier}" does not export ${name}. Name an export of ${path}, or the module that exports ${name}.`;
}

function problem(
	context: ImportContext,
	entry: DocumentedImport,
	module: DocumentedModule,
	owner: WorkspacePackage,
): Effect.Effect<string | undefined, FilesystemFailure> {
	if (module.kind === "missing") {
		return Effect.succeed(`"${entry.specifier}" names no module of ${owner.name}. Use the path of a module its package.json "exports" maps.`);
	}
	const name = entry.name;
	if (name === undefined) {
		return Effect.succeed(undefined);
	}
	return Effect.map(context.readText(module.path), (text) =>
		text !== undefined && exportsName(module.path, text, name) === false ? missingExport(entry.specifier, module.path, name) : undefined,
	);
}

export function importFindings(context: ImportContext, file: string, markdown: string): Effect.Effect<readonly Finding[], FilesystemFailure> {
	const entries = documentedImports(markdown, { owner: context.owner, packages: (name) => context.packages.has(name) });
	const unique = [...new Map(entries.map((entry) => [`${entry.line} ${entry.specifier} ${entry.name ?? ""}`, entry])).values()];
	return Effect.map(
		Effect.forEach(unique, (entry) => {
			const owner = context.packages.get(packageNameOf(entry.specifier));
			if (owner === undefined) {
				return Effect.succeed([]);
			}
			const module = documentedModule(context.root, context.generated, owner, context.exports.get(owner.name), entry.specifier);
			return Effect.map(problem(context, entry, module, owner), (message): readonly Finding[] =>
				message === undefined ? [] : [{ file, line: entry.line, message, subject: entry.specifier }],
			);
		}),
		(findings) => [...new Map(findings.flat().map((finding) => [`${finding.line} ${finding.message}`, finding])).values()],
	);
}
