import { Context, Effect, type Layer, Schema, Stream } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import { rpcBoundary } from "#boundary.ts";
import { rpcBoundaryHandlers } from "#rpcBoundaryHandlers.ts";
import { InternalServerError } from "#taxonomy.ts";

class Storage extends Context.Service<Storage, string>()("test/Storage") {}
const Read = Rpc.make("Read", { error: InternalServerError, payload: { id: Schema.Number }, success: Schema.String });
const Follow = Rpc.make("Follow", { error: InternalServerError, stream: true, success: Schema.String });
const Api = RpcGroup.make(Read, Follow);
const boundary = rpcBoundary(InternalServerError, { unexpected: (message) => new InternalServerError({ message }) });
const handlers = rpcBoundaryHandlers(Api, boundary, {
	Follow: () => Rpc.fork(Stream.fromEffect(Storage)),
	Read: ({ id }) => {
		expectTypeOf(id).toEqualTypeOf<number>();
		return Effect.flatMap(Storage, (value) => (id > 0 ? Effect.succeed(value) : Effect.fail("storage unavailable")));
	},
});
const layer = Api.toLayer(Effect.succeed(handlers));
expectTypeOf(layer).toEqualTypeOf<Layer.Layer<Rpc.ToHandler<typeof Read | typeof Follow>, never, Storage>>();
expectTypeOf<ReturnType<typeof handlers.Read>>().toEqualTypeOf<Effect.Effect<string, InternalServerError, Storage>>();
expectTypeOf<ReturnType<typeof handlers.Follow>>().toEqualTypeOf<Rpc.Wrapper<Stream.Stream<string, InternalServerError, Storage>>>();

rpcBoundaryHandlers(Api, boundary, {
	Follow: () => Stream.empty,
	// @ts-expect-error A boundary must keep the RPC's success type.
	Read: () => Effect.succeed(123),
});

// @ts-expect-error All group handlers must be implemented.
rpcBoundaryHandlers(Api, boundary, { Read: () => Effect.succeed("note") });

const OtherApi = RpcGroup.make(Rpc.make("Other", { success: Schema.String }));
const otherHandlers = rpcBoundaryHandlers(OtherApi, boundary, { Other: () => Effect.succeed("note") });
// @ts-expect-error Each RPC must declare the boundary's rejection schema.
OtherApi.toLayer(otherHandlers);
