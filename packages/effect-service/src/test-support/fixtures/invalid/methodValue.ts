import { Effect } from "effect";
import { defineService } from "#define-service.ts";

defineService({
	id: "invalid/MethodValue",
	initialize: Effect.void,
	methods: () => ({ value: Effect.succeed("value") }),
	requires: [],
});
