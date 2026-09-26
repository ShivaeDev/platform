import { Effect } from "effect";
import { defineService } from "../../../src/index.ts";

const genericIdentity = Effect.fn("InvalidGeneric.identity")(<Value>(value: Value) => Effect.succeed(value));

defineService({
	id: "invalid/Generic",
	initialize: Effect.void,
	methods: () => ({ genericIdentity }),
	requires: [],
});
