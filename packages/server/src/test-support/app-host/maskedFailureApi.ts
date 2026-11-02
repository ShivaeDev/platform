import { Cause, Effect, Exit, Layer, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";

export class MaskedRejection extends Schema.TaggedError<MaskedRejection>()("MaskedRejection", {
	active: Schema.Boolean.annotate({ sensitive: true }),
	count: Schema.Number.annotate({ sensitive: true }),
	encoded: Schema.NumberFromString.check(Schema.isGreaterThan(0)).annotate({ redactionMask: "1", sensitive: true }),
	items: Schema.Array(Schema.String).annotate({ sensitive: true }),
	message: Schema.String,
	nil: Schema.Null.annotate({ sensitive: true }),
	optional: Schema.optionalKey(Schema.String.annotate({ sensitive: true })),
	positive: Schema.Number.check(Schema.isGreaterThan(0)).annotate({ redactionMask: 1, sensitive: true }),
	profile: Schema.Struct({ age: Schema.Number, city: Schema.String }).annotate({ sensitive: true }),
}) {}
const Failures = Schema.Union([MaskedRejection, InternalServerError]);
export const maskedFailureApi = RpcGroup.make(
	Rpc.make("maskedFailureStream", { error: Failures, payload: { interrupt: Schema.Boolean }, stream: true, success: Schema.Void }),
	Rpc.make("maskedNull", { error: Schema.Null.annotate({ sensitive: true }), success: Schema.Void }),
	Rpc.make("maskedFailure", {
		error: Failures,
		payload: { interrupt: Schema.Boolean },
		success: Schema.Void,
	}),
);
const boundary = rpcBoundary(Failures, { unexpected: (message) => new InternalServerError({ message }) });
function rejection(interrupt: boolean) {
	const failure = new MaskedRejection({
		active: true,
		count: 987_654_321,
		encoded: 987_123,
		items: ["private item"],
		message: "Cannot save",
		nil: null,
		positive: 456_789,
		profile: { age: 42, city: "private city" },
	});
	return boundary(Effect.failCause(interrupt ? Cause.combine(Cause.fail(failure), Cause.interrupt(123)) : Cause.fail(failure)));
}
export const maskedFailureHandlers = maskedFailureApi.toLayer({
	maskedFailure: ({ interrupt }) => rejection(interrupt),
	maskedFailureStream: ({ interrupt }) => Stream.fromEffect(rejection(interrupt)),
	maskedNull: () => Effect.fail(null),
});

export function receiveMaskedFailure(url: string, interrupt: boolean, shape: "request" | "stream" | "null" = "request") {
	const protocol = RpcClient.layerProtocolHttp({ url: `${url}/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return Effect.gen(function* () {
		const client = yield* RpcClient.make(maskedFailureApi);
		function invocation(): Effect.Effect<void, unknown> {
			switch (shape) {
				case "null":
					return client.maskedNull();
				case "stream":
					return Stream.runDrain(client.maskedFailureStream({ interrupt }));
				case "request":
					return client.maskedFailure({ interrupt });
			}
		}
		const exit = yield* Effect.exit(invocation());
		if (Exit.isSuccess(exit)) {
			return { rejection: "succeeded" };
		}
		const failure = exit.cause.reasons.find(Cause.isFailReason)?.error;
		if (failure === null) {
			return { cancelled: Cause.hasInterrupts(exit.cause), rejection: "masked null" };
		}
		if (!(failure instanceof MaskedRejection)) {
			return yield* Effect.failCause(exit.cause);
		}
		return {
			cancelled: Cause.hasInterrupts(exit.cause),
			rejection: failure instanceof MaskedRejection ? "MaskedRejection" : failure,
			value: { ...failure, message: failure.message },
		};
	}).pipe(Effect.provide(protocol), Effect.scoped);
}
