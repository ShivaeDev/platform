import type { Scope } from "effect";
import { Context, Effect } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { expectTypeOf } from "vitest";
import { each } from "#each.ts";
import type { Reconciler } from "#Reconciler.ts";
import { run } from "#run.ts";

class Reader extends Context.Service<Reader, { readonly value: string }>()("@shivaedev/reconciler/Reader") {}
class Actor extends Context.Service<Actor, { readonly value: string }>()("@shivaedev/reconciler/Actor") {}
class Recorder extends Context.Service<Recorder, { readonly value: string }>()("@shivaedev/reconciler/Recorder") {}

const options = {
	act: (_value: unknown) => Effect.andThen(Actor, Effect.fail("act failure" as const)),
	keys: [],
	onFailure: () => Effect.andThen(Recorder, Effect.fail("record failure" as const)),
	read: Effect.andThen(Reader, Effect.fail("read failure" as const)),
};

expectTypeOf(run(options)).toEqualTypeOf<
	Effect.Effect<Reconciler<"read failure" | "act failure" | "record failure">, never, Reader | Actor | Recorder | Reactivity.Reactivity | Scope.Scope>
>();

const keyed = each({ ...options, key: (row) => row, read: Effect.as(Reader, ["row"]) });
expectTypeOf<Effect.Services<typeof keyed>>().toEqualTypeOf<Reader | Actor | Recorder | Reactivity.Reactivity | Scope.Scope>();
