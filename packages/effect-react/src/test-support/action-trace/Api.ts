import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";

export const Api = RpcGroup.make(Rpc.make("write", { payload: { id: Schema.Number }, success: Schema.String }));
