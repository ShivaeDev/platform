import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { RequestTracing } from "#middleware.ts";

export const SECRETS = ["hunter2-plaintext", "key-plaintext", "token-plaintext"] as const;

class LeakyDefect extends Error {
	readonly apiKey = "key-plaintext";
}
export const Crashes = RpcGroup.make(
	Rpc.make("Crash", { payload: { kind: Schema.Literals(["an object defect", "an error defect"]) }, success: Schema.Void }),
).middleware(RequestTracing);
export const Handlers = Crashes.toLayer({
	Crash: ({ kind }) =>
		kind === "an object defect"
			? Effect.die({ detail: "object defect", password: "hunter2-plaintext" })
			: Effect.die(new LeakyDefect("leaky defect", { cause: { reason: "nested", token: "token-plaintext" } })),
});
