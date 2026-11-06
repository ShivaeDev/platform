import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";

export const ShutdownApi = RpcGroup.make(Rpc.make("watch", { stream: true, success: Schema.String }));
export const DRAINING_MILLIS = 5000;
export const HTTP_GRACE_MILLIS = 100;
