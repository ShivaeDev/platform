import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";

const PrivateState = Schema.Struct({ state: Schema.Literals(["private-state", "private-paused"]).annotate({ sensitive: true }) });
const PublicState = Schema.Struct({ state: Schema.Literals(["active", "paused"]) });
const StateFailure = Schema.Union([Schema.Struct({ _tag: Schema.Literal("Blocked"), state: Schema.Literals(["active", "paused"]) }), Conflict]);
export const scoped = RpcGroup.make(
	Rpc.make("privateState", { error: Conflict, payload: { fail: Schema.Boolean }, success: PrivateState }),
	Rpc.make("publicState", { error: StateFailure, payload: { fail: Schema.Boolean }, success: PublicState }),
);
export const ambiguous = RpcGroup.make(Rpc.make("ambiguousState", { error: StateFailure, payload: { fail: Schema.Boolean }, success: PrivateState }));
