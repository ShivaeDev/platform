import { Effect, type Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import type { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import type { QueryRequest } from "@shivaedev/contract/serverMetadata.ts";
import type { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { rerunQuery } from "#rerunQuery.ts";
import { Api, type PolicyUnavailable, type QueryUnavailable, type Store } from "#test/rerun/fixture.ts";

declare const options: Parameters<Rpc.Handler<string>["handler"]>[1];
declare const request: QueryRequest;
const compared = Api.application.omit("rerun.barrier", "rerun.hinted", "rerun.rename");
const rerun = rerunQuery(compared, options)(request);

expectTypeOf<Effect.Services<typeof rerun>>().toEqualTypeOf<Rpc.Handler<"rerun.compare"> | Store>();
expectTypeOf<Effect.Error<typeof rerun>>().toEqualTypeOf<
	PolicyUnavailable | QueryUnavailable | QueryReadDenied | MissingReadPolicy | AuthUnavailable | Forbidden | Unauthorized
>();

declare const handlers: Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<typeof Api.application>>>;
const applicationRerun = rerunQuery(Api.application, options)(request).pipe(Effect.provide(handlers));
expectTypeOf<Effect.Services<typeof applicationRerun>>().toEqualTypeOf<Store>();
