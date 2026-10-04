import { Effect } from "effect";
import { defineService } from "#index.ts";

defineService({
	id: "invalid/MethodValue",
	initialize: Effect.void,
	methods: () => ({ value: Effect.succeed("value") }),
	requires: [],
});
