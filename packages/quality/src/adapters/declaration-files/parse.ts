import { Effect } from "effect";
import ts from "typescript";
import type { initializeDeclarationFiles } from "#adapters/declaration-files/initialize.ts";

export function parse(state: Effect.Success<typeof initializeDeclarationFiles>) {
	return Effect.fn("DeclarationFiles.parse")((fileName: string, text: string, options: ts.CompilerOptions) =>
		Effect.sync(() => state.registry.acquireDocument(fileName, options, ts.ScriptSnapshot.fromString(text), text)),
	);
}
