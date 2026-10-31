import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";

const PrivateState = Schema.Struct({ state: Schema.Literals(["private-state", "private-paused"]).annotate({ sensitive: true }) });
const PublicState = Schema.Struct({ state: Schema.Literals(["active", "paused"]) });
const StateFailure = Schema.Union([Schema.Struct({ _tag: Schema.Literal("Blocked"), state: Schema.Literals(["active", "paused"]) }), Conflict]);
const ContainedState = Schema.Struct({
	output: Schema.NullOr(Schema.Struct({ _tag: Schema.Literal("PrivateOutput"), state: Schema.Literal("private-state") })).annotate({
		sensitive: true,
	}),
	state: Schema.Literal("active"),
});
export const scoped = RpcGroup.make(
	Rpc.make("privateState", { error: Conflict, payload: { fail: Schema.Boolean }, success: PrivateState }),
	Rpc.make("publicState", { error: StateFailure, payload: { fail: Schema.Boolean }, success: PublicState }),
	Rpc.make("containedState", {
		error: StateFailure,
		payload: { fail: Schema.Boolean },
		success: ContainedState,
	}),
	Rpc.make("optionalState", { error: StateFailure, payload: { fail: Schema.Boolean }, success: Schema.OptionFromNullOr(ContainedState) }),
);
export const ambiguous = RpcGroup.make(Rpc.make("ambiguousState", { error: StateFailure, payload: { fail: Schema.Boolean }, success: PrivateState }));
