import { Effect } from "effect";
import { defineService } from "#index.ts";

const PrivateState = defineService({
	id: "invalid/PrivateState",
	initialize: Effect.succeed({ secret: "secret" }),
	methods: (state) => ({
		value: () => Effect.succeed(state.secret),
	}),
	requires: [],
});

Effect.gen(function* () {
	const service = yield* PrivateState;
	return service.secret;
});
