import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { RequestTracing } from "#middleware.ts";

class LeakyDefect extends Error {
	readonly apiKey = "key-plaintext";
}
export const Crashes = RpcGroup.make(Rpc.make("Crash", { payload: { kind: Schema.String }, success: Schema.Void })).middleware(RequestTracing);
export const Handlers = Crashes.toLayer({
	Crash: ({ kind }) =>
		kind === "object"
			? Effect.die({ detail: "object defect", password: "hunter2-plaintext" })
			: Effect.die(new LeakyDefect("leaky defect", { cause: { reason: "nested", token: "token-plaintext" } })),
});
