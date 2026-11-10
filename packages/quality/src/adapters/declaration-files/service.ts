import type { Effect } from "effect";
import type ts from "typescript";
import { defineService } from "@shivaedev/service/defineService.ts";
import { initializeDeclarationFiles } from "#adapters/declaration-files/initialize.ts";
import { parse } from "#adapters/declaration-files/parse.ts";
import { reader } from "#adapters/declaration-files/reader.ts";

export const DeclarationFiles = defineService({
	id: "@shivaedev/quality/DeclarationFiles",
	initialize: initializeDeclarationFiles,
	methods: (state) => ({
		parse: parse(state) satisfies (fileName: string, text: string, options: ts.CompilerOptions) => Effect.Effect<ts.SourceFile>,
		reader: reader(state) satisfies (host: ts.CompilerHost, options: ts.CompilerOptions) => Effect.Effect<ts.CompilerHost["getSourceFile"]>,
	}),
	requires: [],
});
