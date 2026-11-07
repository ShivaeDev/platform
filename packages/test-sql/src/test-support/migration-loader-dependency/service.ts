import { Effect } from "effect";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";

export const MigrationLoaderDependency = defineService({
	id: "@shivaedev/test-sql/MigrationLoaderDependency",
	initialize: Effect.void,
	methods: () => ({}),
	requires: [],
});
export type MigrationLoaderDependency = typeof MigrationLoaderDependency.Identifier;
