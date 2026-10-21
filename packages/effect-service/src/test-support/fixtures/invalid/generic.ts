import { Effect } from "effect";
import { defineService } from "#defineService.ts";

const genericIdentity = Effect.fn("InvalidGeneric.genericIdentity")(<TValue>(value: TValue) => Effect.succeed(value));

defineService({
	id: "invalid/Generic",
	initialize: Effect.void,
	methods: () => ({ genericIdentity }),
	requires: [],
});
