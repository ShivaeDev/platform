import { Effect, Schema } from "effect";
import { HttpServerRequest } from "effect/http";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { Forbidden } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";
import { Identity, SessionUser } from "#rpc/identity.ts";
import { AuthenticatedUser } from "#rpc/middleware.ts";

export const Api = contract("native", {
	keyScope: "session",
	queries: [
		query("profile", {
			payload: { owner: Schema.String },
			reads: () => [{ _tag: "List", collection: "profile" }],
			rejections: { Forbidden },
			success: Schema.Struct({ email: Schema.String, id: Schema.String, name: Schema.String, role: Schema.NullOr(Schema.String) }),
		}),
	],
}).middleware(AuthenticatedUser);

export const handlers = Api.application.toLayer({
	"native.profile": ({ owner }) =>
		Effect.gen(function* () {
			const identity = yield* Identity;
			const user = yield* SessionUser;
			if (identity.id !== owner) {
				return yield* new Forbidden({ message: "This profile belongs to another account" });
			}
			return { email: user.email, id: identity.id, name: user.name, role: user.role ?? null };
		}),
});

export const diagnostic = Effect.gen(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const encoded = `Bearer ${encodeURIComponent(request.headers.authorization?.slice(7) ?? "")}`;
	yield* Effect.logInfo({ authorization: request.headers.authorization, detail: request.headers.authorization, encoded });
	yield* Effect.annotateCurrentSpan("detail", request.headers.authorization);
	yield* Effect.annotateCurrentSpan("encoded", encoded);
	return "diagnostic";
});
