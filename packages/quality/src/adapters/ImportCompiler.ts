import { Effect } from "effect";
import type ts from "typescript";
import { defineService } from "@shivaedev/service/defineService.ts";
import { analyzeDepartures } from "#adapters/imports/analyzeDepartures.ts";
import { analyzeGraph } from "#adapters/imports/analyzeGraph.ts";
import { checkBrowser } from "#adapters/imports/checkBrowser.ts";

export const ImportCompiler = defineService({
	id: "@shivaedev/quality/ImportCompiler",
	initialize: Effect.void,
	methods: () => ({
		browserChecker: checkBrowser satisfies (source: ts.SourceFile) => Effect.Effect<ts.TypeChecker>,
		departures: analyzeDepartures,
		graph: analyzeGraph,
	}),
	requires: [],
});
