import { Context, Effect, type Layer, Schema, Stream } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import { rpcBoundaryHandlers } from "#rpcBoundaryHandlers.ts";
import { Conflict, InternalServerError, NotFound } from "#taxonomy.ts";

class Storage extends Context.Service<Storage, string>()("@shivaedev/errors/test/Storage") {}
const Read = Rpc.make("Read", { error: InternalServerError, payload: { id: Schema.Number }, success: Schema.String });
const Follow = Rpc.make("Follow", { error: InternalServerError, stream: true, success: Schema.String });
const Api = RpcGroup.make(Read, Follow);
const boundaryOptions = { unexpected: (message: string) => new InternalServerError({ message }) };
const handlers = rpcBoundaryHandlers(Api, boundaryOptions, {
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

rpcBoundaryHandlers(Api, boundaryOptions, {
	Follow: () => Stream.empty,
	// @ts-expect-error A boundary must keep the RPC's success type.
	Read: () => Effect.succeed(123),
});

// @ts-expect-error All group handlers must be implemented.
rpcBoundaryHandlers(Api, boundaryOptions, { Read: () => Effect.succeed("note") });

const OtherApi = RpcGroup.make(Rpc.make("Other", { success: Schema.String }));
// @ts-expect-error Each RPC must declare the fallback rejection.
rpcBoundaryHandlers(OtherApi, boundaryOptions, { Other: () => Effect.succeed("note") });

const ReadMissing = Rpc.make("ReadMissing", { error: Schema.Union([NotFound, InternalServerError]), success: Schema.String });
const SaveConflict = Rpc.make("SaveConflict", { error: Schema.Union([Conflict, InternalServerError]), success: Schema.String });
const MixedApi = RpcGroup.make(ReadMissing, SaveConflict);
const mixedHandlers = rpcBoundaryHandlers(MixedApi, boundaryOptions, {
	ReadMissing: () => Effect.fail(new NotFound({ message: "Missing" })),
	SaveConflict: () => Effect.fail(new Conflict({ field: "title", message: "Taken" })),
});
MixedApi.toLayer(mixedHandlers);
expectTypeOf<Effect.Error<ReturnType<typeof mixedHandlers.ReadMissing>>>().toEqualTypeOf<NotFound | InternalServerError>();
expectTypeOf<Effect.Error<ReturnType<typeof mixedHandlers.SaveConflict>>>().toEqualTypeOf<Conflict | InternalServerError>();
// @ts-expect-error ReadMissing's boundary does not declare Conflict, even though SaveConflict does.
const undeclaredRejection: Effect.Error<ReturnType<typeof mixedHandlers.ReadMissing>> = new Conflict({ field: "title", message: "Taken" });
void undeclaredRejection;
// @ts-expect-error The fallback must be declared by every operation, not just SaveConflict.
rpcBoundaryHandlers(MixedApi, { unexpected: () => new Conflict({ field: "title", message: "Taken" }) }, mixedHandlers);
