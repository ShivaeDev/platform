import { Effect, Redacted, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Conflict } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { RequestId } from "#rpc/identity.ts";
import { RequestTracing } from "#rpc/middleware.ts";

const Registration = Schema.Struct({
	devices: Schema.Array(Schema.Struct({ name: Schema.String, refreshToken: Schema.String })),
	email: Schema.String,
	note: Schema.Redacted(Schema.String),
	password: Schema.String,
	profile: Schema.Struct({ apiKey: Schema.String, nickname: Schema.String }),
});
export const Accounts = RpcGroup.make(
	Rpc.make("Echo", { success: Schema.String }),
	Rpc.make("Register", { error: Conflict, payload: Registration, success: Schema.Void }),
	Rpc.make("Crash", { payload: Registration, success: Schema.Void }),
	Rpc.make("ExternalRejection", { error: Schema.String, success: Schema.Void }),
).middleware(RequestTracing);
export const Handlers = Accounts.toLayer({
	Crash: () => Effect.die(new Error("boom")),
	Echo: () => Effect.andThen(Effect.logInfo("echo"), RequestId),
	ExternalRejection: () => Effect.fail("upstream rate limit"),
	Register: () => Effect.fail(new Conflict({ field: "email", message: "Email already registered" })),
});
export const registration = {
	devices: [{ name: "phone", refreshToken: "refresh-plaintext" }],
	email: "alice@example.test",
	note: Redacted.make("note-plaintext"),
	password: "hunter2-plaintext",
	profile: { apiKey: "key-plaintext", nickname: "alice" },
};
