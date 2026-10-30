import { Effect, Layer, Redacted, Schema, SchemaGetter } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#appHost.ts";
import { host } from "./story.ts";

const Rejected = Schema.Struct({
	_tag: Schema.Literal("Rejected"),
	sealed: Schema.RedactedFromValue(Schema.String),
	visible: Schema.String,
}).pipe(Schema.encodeKeys({ sealed: "wireValue" }));
const RenamedPassword = Schema.Struct({ password: Schema.String }).pipe(Schema.encodeKeys({ password: "wireCode" }));
const Computed = Schema.Struct({ sealed: Schema.String.annotate({ sensitive: true }) }).pipe(
	Schema.encodeTo(Schema.Struct({ computedWire: Schema.String }), {
		decode: SchemaGetter.transform(({ computedWire }) => ({ sealed: computedWire.toLowerCase() })),
		encode: SchemaGetter.transform(({ sealed }) => ({ computedWire: sealed.toUpperCase() })),
	}),
);
const Api = RpcGroup.make(
	Rpc.make("computedFailure", { error: Computed, payload: { value: Schema.String }, success: Schema.Void }),
	Rpc.make("renamedFailure", { error: Rejected, payload: { value: Schema.String }, success: Schema.Void }),
	Rpc.make("renamedPassword", { error: RenamedPassword, payload: { value: Schema.String }, success: Schema.Void }),
	Rpc.make("errorStack", { error: Schema.Defect({ includeStack: true }), payload: { value: Schema.String }, success: Schema.Void }),
);
const handlers = Api.toLayer({
	computedFailure: ({ value }) => Effect.fail({ sealed: value }),
	errorStack: ({ value }) => Effect.fail(new Error(value)),
	renamedFailure: ({ value }) =>
		Effect.gen(function* () {
			const diagnostic = { control: "public control", sealed: value, visible: "public detail", wireValue: value };
			yield* Effect.logInfo("encoded failure").pipe(Effect.annotateLogs(diagnostic));
			yield* Effect.annotateCurrentSpan(diagnostic);
			return yield* Effect.fail({ _tag: "Rejected" as const, sealed: Redacted.make(value), visible: diagnostic.visible });
		}),
	renamedPassword: ({ value }) => Effect.fail({ password: value }),
});

export const encodedFailures = host.trait("configured", "the host encodes renamed fields and Error stacks", (state) => {
	state.config.sensitiveKeys = ["message"];
	state.build = () => appHost({ config: state.config, group: Api, handlers, policy: "loopback", services: Layer.empty });
});
