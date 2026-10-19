import type { Stream } from "effect";
import type { Rpc, RpcClient, RpcGroup } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import { contract } from "#contract.ts";
import type { Key } from "#keys.ts";
import type { LiveHint } from "#live.ts";
import { type Denied, type Guard, type Notes, notes } from "#test/notes.ts";

type Rpcs = RpcGroup.Rpcs<typeof Notes>;
type Changes = Rpc.ExtractTag<Rpcs, "notes.$changes">;
declare const client: RpcClient.RpcClient.Flat<Rpcs, RpcClientError>;

const changes = client("notes.$changes", { keys: [notes.item(1)] });
expectTypeOf(changes).toEqualTypeOf<Stream.Stream<LiveHint, Denied | RpcClientError>>();
expectTypeOf<Rpc.Payload<Changes>>().toEqualTypeOf<{ readonly keys: readonly Key[] }>();
expectTypeOf<Rpc.Middleware<Changes>>().toEqualTypeOf<Guard>();

const Empty = contract("empty", {});
type EmptyChanges = RpcGroup.Rpcs<typeof Empty>;
expectTypeOf<EmptyChanges["_tag"]>().toEqualTypeOf<"empty.$changes">();
expectTypeOf<Rpc.Middleware<EmptyChanges>>().toEqualTypeOf<never>();
