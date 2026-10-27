import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import type { LiveStatus } from "#live.ts";
import type { MissingReadPolicy } from "#readPolicyErrors.ts";
import { liveClient } from "#test/live/client.ts";
import type { Unavailable } from "#test/live/contract.ts";
import type { Denied } from "#test/notes.ts";

type WithPolicyFailure<T> =
	T extends Atom.Atom<AsyncResult.AsyncResult<infer A, infer E>> ? Atom.Atom<AsyncResult.AsyncResult<A, E | MissingReadPolicy>> : never;
const fixture = liveClient("http://127.0.0.1");
expectTypeOf(fixture.api.get.query).returns.toEqualTypeOf<WithPolicyFailure<ReturnType<typeof fixture.Client.query<"notes.get">>>>();
expectTypeOf(fixture.status).toEqualTypeOf<Atom.Writable<LiveStatus<Unavailable | Denied | RpcClientError>>>();
expectTypeOf(fixture.connection).toEqualTypeOf<Atom.Atom<AsyncResult.AsyncResult<void, never>>>();
