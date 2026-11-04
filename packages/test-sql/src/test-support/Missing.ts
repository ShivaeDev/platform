import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";

export const Missing = defineService({
	id: "@shivaedev/test-sql/types/Missing",
	initialize: Effect.void,
	methods: () => ({}),
	requires: [],
});
export type Missing = typeof Missing.Identifier;
