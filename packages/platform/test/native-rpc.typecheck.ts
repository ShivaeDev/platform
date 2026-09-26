import { Effect, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/unstable/rpc";
import { expectTypeOf } from "vitest";

const Item = Schema.Struct({ id: Schema.String, title: Schema.String });
const Missing = Schema.Struct({
	_tag: Schema.Literal("Missing"),
	id: Schema.String,
});
const Items = RpcGroup.make(
	Rpc.make("find", {
		payload: { id: Schema.String },
		success: Item,
		error: Missing,
	}),
);

Items.toLayer({ find: ({ id }) => Effect.succeed({ id, title: "Typed" }) });
Items.toLayer({
	find: ({ id }) => Effect.fail({ _tag: "Missing" as const, id }),
});

// @ts-expect-error Handlers must return the declared ordinary success shape.
Items.toLayer({ find: () => Effect.succeed({ title: "Missing ID" }) });
// @ts-expect-error Handlers cannot fail with an undeclared error.
Items.toLayer({ find: () => Effect.fail("unstructured error") });
// @ts-expect-error Every declared RPC needs an implementation.
Items.toLayer({});

Effect.gen(function* () {
	const client = yield* RpcTest.makeClient(Items);
	const result = client.find({ id: "item-1" });
	expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<typeof Item.Type>();
	expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<typeof Missing.Type>();
	// @ts-expect-error Client payloads are inferred from the declaration.
	client.find({ id: 1 });
	// @ts-expect-error Generated clients expose only declared procedures.
	client.remove({ id: "item-1" });
});
