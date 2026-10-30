import { Context, Effect, type Layer, Option, Schema } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { authorizeReads, type QueryReadPolicy } from "#readPolicy.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";

class Database extends Context.Service<Database, boolean>()("test/PolicyDatabase") {}
class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>()("ServiceUnavailable", {}) {}
const policy: QueryReadPolicy<void, ServiceUnavailable, Database> = () =>
	Effect.flatMap(Database, (available) => (available ? Effect.succeed(true) : Effect.fail(new ServiceUnavailable())));
const Read = query("read", { readPolicy: policy, reads: () => [], rejections: { ServiceUnavailable } });
const Reads = contract("reads", { queries: [Read] });
const handlers = Reads.application.toLayer({ "reads.read": () => Effect.void });
expectTypeOf<Layer.Services<typeof handlers>>().toEqualTypeOf<Database>();
expectTypeOf<Effect.Error<ReturnType<typeof policy>>>().toEqualTypeOf<ServiceUnavailable>();
// @ts-expect-error Policy services must be installed even when the handler needs none.
const unprovided: Layer.Layer<Layer.Success<typeof handlers>> = handlers;
void unprovided;
// @ts-expect-error A policy can only fail with errors declared in the query's rejections.
query("undeclared", { readPolicy: policy, reads: () => [] });

type ReadRpc = Extract<RpcGroup.Rpcs<typeof Reads>, { readonly _tag: "reads.read" }>;
type ChangesRpc = Extract<RpcGroup.Rpcs<typeof Reads>, { readonly _tag: "reads.$changes" }>;
expectTypeOf<Rpc.ErrorExit<ReadRpc>>().toEqualTypeOf<ServiceUnavailable | QueryReadDenied>();
expectTypeOf<Rpc.ExtractRequires<ChangesRpc, "reads.$changes">>().toEqualTypeOf<Database>();
declare const rpc: ReadRpc;
const authorized = authorizeReads(Effect.void, { payload: undefined, rpc }, Option.none());
expectTypeOf<Effect.Services<typeof authorized>>().toEqualTypeOf<Database>();
