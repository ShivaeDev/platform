import { Context, Effect } from "effect";
import { defineService } from "#index.ts";

class Prefix extends Context.Service<Prefix, { readonly value: string }>()("invalid/Prefix") {}

function overloaded(value: string): Effect.Effect<string, never, Prefix>;
function overloaded(value: string | number): Effect.Effect<string>;
function overloaded(value: string | number): Effect.Effect<string, never, Prefix> {
	return Effect.map(Prefix, (prefix) => `${prefix.value}${value}`);
}

defineService({
	id: "invalid/OverloadedHiddenRequirement",
	initialize: Effect.void,
	methods: () => ({ overloaded }),
	requires: [],
});
