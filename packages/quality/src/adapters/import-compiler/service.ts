import { Effect } from "effect";
import type ts from "typescript";
import { defineService } from "@shivaedev/service/defineService.ts";
import { browserChecker } from "./browserChecker.ts";
import { departures } from "./departures.ts";
import { graph } from "./graph.ts";

export const ImportCompiler = defineService({
	id: "@shivaedev/quality/ImportCompiler",
	initialize: Effect.void,
	methods: () => ({
		browserChecker: browserChecker satisfies (source: ts.SourceFile) => Effect.Effect<ts.TypeChecker>,
		departures,
		graph,
	}),
	requires: [],
});
