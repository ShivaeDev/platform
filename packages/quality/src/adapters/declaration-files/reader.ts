import { dirname } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import type { initializeDeclarationFiles } from "#adapters/declaration-files/initialize.ts";

const LIBRARY = `${dirname(ts.getDefaultLibFilePath({}))}/`;
const DECLARATION = /\.d\.[cm]?ts$/u;

// Workspace and fixture files can differ between programs through a rule's own sources, so only installed and library declarations are shared.
function shareable(fileName: string): boolean {
	return DECLARATION.test(fileName) && (fileName.startsWith(LIBRARY) || fileName.includes("/node_modules/"));
}

export function reader(state: Effect.Success<typeof initializeDeclarationFiles>) {
	return Effect.fn("DeclarationFiles.reader")((host: ts.CompilerHost, options: ts.CompilerOptions) =>
		Effect.sync((): ts.CompilerHost["getSourceFile"] => {
			const read = host.getSourceFile.bind(host);
			return (fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) => {
				const text = shouldCreateNewSourceFile || !shareable(fileName) ? undefined : host.readFile(fileName);
				// The registry binds a file once for every program in its bucket, so it keys buckets by the options that change parsing and
				// binding; the text is the version, so a file whose text changed is parsed again.
				return text === undefined
					? read(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile)
					: state.registry.acquireDocument(fileName, options, ts.ScriptSnapshot.fromString(text), text, undefined, languageVersionOrOptions);
			};
		}),
	);
}
