import { Effect } from "effect";
import { Reactivity } from "effect/reactivity/Reactivity";
import { defineService } from "#defineService.ts";

defineService({
	id: "@shivaedev/service/invalid/MethodReactivity",
	initialize: Effect.void,
	methods: () => ({ write: () => Reactivity }),
	requires: [],
});
