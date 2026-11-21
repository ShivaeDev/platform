import type { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type { RpcGroup } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import type { BoundQuery, Failure } from "#Bound.ts";
import { makeClient } from "#makeClient.ts";
import type { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { type AccessDenied, type ClientOffline, type ListUnavailable, type NoteMissing, Records } from "#test/queryFailureContract.ts";
import type { WebSocketRequired } from "#WebSocketRequired.ts";

type Rpcs = RpcGroup.Rpcs<typeof Records>;
const api = makeClient({ records: Records }, { url: "https://app.test/rpc" }).api.records;
type QueryFailure = Atom.Failure<ReturnType<typeof api.get.query>>;
type Expected =
	| NoteMissing
	| ListUnavailable
	| AccessDenied
	| ClientOffline
	| RpcClientError
	| QueryReadDenied
	| MissingReadPolicy
	| WebSocketRequired;

expectTypeOf<QueryFailure>().toEqualTypeOf<Expected>();
expectTypeOf<Atom.Failure<ReturnType<typeof api.list.query>>>().toEqualTypeOf<Expected>();
expectTypeOf<Effect.Error<ReturnType<typeof api.get.run>>>().toEqualTypeOf<
	NoteMissing | AccessDenied | ClientOffline | RpcClientError | QueryReadDenied | MissingReadPolicy | WebSocketRequired
>();
expectTypeOf<Failure<Extract<Rpcs, { readonly _tag: "query-failures.get" }>>>().toEqualTypeOf<Effect.Error<ReturnType<typeof api.get.run>>>();
expectTypeOf<Atom.Failure<ReturnType<BoundQuery<Extract<Rpcs, { readonly _tag: "query-failures.get" }>, "Self">["query"]>>>().toEqualTypeOf<
	Effect.Error<ReturnType<typeof api.get.run>>
>();

declare const failure: QueryFailure;
switch (failure._tag) {
	case "NoteMissing":
	case "ListUnavailable":
	case "AccessDenied":
	case "ClientOffline":
	case "RpcClientError":
	case "QueryReadDenied":
	case "MissingReadPolicy":
	case "WebSocketRequired":
		break;
	default:
		expectTypeOf(failure).toBeNever();
}
