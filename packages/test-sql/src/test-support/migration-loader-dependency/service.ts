import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";

export const MigrationLoaderDependency = defineService({
	id: "@shivaedev/test-sql/MigrationLoaderDependency",
	initialize: Effect.void,
	methods: () => ({}),
	requires: [],
});
export type MigrationLoaderDependency = typeof MigrationLoaderDependency.Identifier;
