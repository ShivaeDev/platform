import { Effect } from "effect";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";

export const RaceDependency = defineService({
	id: "@shivaedev/test-sql/RaceDependency",
	initialize: Effect.void,
	methods: () => ({}),
	requires: [],
});
export type RaceDependency = typeof RaceDependency.Identifier;
