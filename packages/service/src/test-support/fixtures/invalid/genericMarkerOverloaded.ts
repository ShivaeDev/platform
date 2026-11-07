import { Effect } from "effect";
import { defineService } from "#adapters/defineService.ts";
import { genericMethod } from "#genericMethod.ts";

function overloaded(value: string): Effect.Effect<string>;
function overloaded(value: number): Effect.Effect<number>;
function overloaded(value: string | number) {
	return Effect.succeed(value);
}

defineService({
	id: "@shivaedev/service/invalid/GenericMarkerOverloaded",
	initialize: Effect.void,
	methods: () => ({ overloaded: genericMethod(overloaded) }),
	requires: [],
});
