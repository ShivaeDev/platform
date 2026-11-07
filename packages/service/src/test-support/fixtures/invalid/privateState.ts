import { Effect } from "effect";
import { defineService } from "#adapters/defineService.ts";

const PrivateState = defineService({
	id: "@shivaedev/service/invalid/PrivateState",
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
