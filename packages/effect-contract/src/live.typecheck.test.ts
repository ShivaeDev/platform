import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import type { LiveStatus } from "#live.ts";
import { liveClient } from "#test/live/client.ts";
import type { Unavailable } from "#test/live/contract.ts";

const fixture = liveClient("http://127.0.0.1");
expectTypeOf(fixture.api.get.query).returns.toEqualTypeOf<ReturnType<typeof fixture.Client.query<"documents.get">>>();
expectTypeOf(fixture.status).toEqualTypeOf<Atom.Writable<LiveStatus<Unavailable | RpcClientError>>>();
expectTypeOf(fixture.connection).toEqualTypeOf<Atom.Atom<AsyncResult.AsyncResult<void, never>>>();
