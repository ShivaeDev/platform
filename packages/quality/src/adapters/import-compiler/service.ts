import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { browserChecker } from "./browserChecker.ts";
import { departures } from "./departures.ts";
import { graph } from "./graph.ts";

export const ImportCompiler = defineService({
	id: "@shivaedev/quality/ImportCompiler",
	initialize: Effect.void,
	methods: () => ({ browserChecker, departures, graph }),
	requires: [],
});
