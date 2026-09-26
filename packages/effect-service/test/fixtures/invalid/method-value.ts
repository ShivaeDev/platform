import { Effect } from "effect";
import { defineService } from "../../../src/index.ts";

defineService({
	id: "invalid/MethodValue",
	initialize: Effect.void,
	methods: () => ({ value: Effect.succeed("value") }),
	requires: [],
});
