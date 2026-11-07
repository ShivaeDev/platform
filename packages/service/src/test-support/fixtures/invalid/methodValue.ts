import { Effect } from "effect";
import { defineService } from "#adapters/defineService.ts";

defineService({
	id: "@shivaedev/service/invalid/MethodValue",
	initialize: Effect.void,
	methods: () => ({ value: Effect.succeed("value") }),
	requires: [],
});
