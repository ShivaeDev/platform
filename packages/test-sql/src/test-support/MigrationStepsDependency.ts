import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";

export const MigrationStepsDependency = defineService({
	id: "@shivaedev/test-sql/MigrationStepsDependency",
	initialize: Effect.void,
	methods: () => ({}),
	requires: [],
});
export type MigrationStepsDependency = typeof MigrationStepsDependency.Identifier;
