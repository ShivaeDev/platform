import { defineService } from "@shivaedev/service/defineService.ts";
import { initializeDeclarationFiles } from "#adapters/declaration-files/initialize.ts";
import { parse } from "#adapters/declaration-files/parse.ts";
import { reader } from "#adapters/declaration-files/reader.ts";

export const DeclarationFiles = defineService({
	id: "@shivaedev/quality/DeclarationFiles",
	initialize: initializeDeclarationFiles,
	methods: (state) => ({ parse: parse(state), reader: reader(state) }),
	requires: [],
});
