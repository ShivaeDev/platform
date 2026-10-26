import { Effect, ErrorReporter, Layer, Redacted, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#appHost.ts";
import { host } from "./story.ts";

const fields = {
	customerRef: Schema.String,
	notes: Schema.optional(
		Schema.Array(Schema.Union([Schema.String, Schema.suspend(() => Schema.Struct({ mailingLine: Schema.String.annotateKey({ sensitive: true }) }))])),
	),
	privateLabels: Schema.optional(Schema.Record(Schema.String, Schema.String.annotate({ sensitive: true }))),
	recoveryCodes: Schema.optional(Schema.Array(Schema.RedactedFromValue(Schema.String))),
	sealed: Schema.RedactedFromValue(Schema.String),
	sensitiveNote: Schema.String.annotate({ sensitive: true }),
	visible: Schema.String,
};
const Rejected = Schema.Struct({ _tag: Schema.Literal("Rejected"), ...fields, internalReference: Schema.Number.annotate({ sensitive: true }) });
const Api = RpcGroup.make(
	Rpc.make("diagnose", {
		error: Rejected,
		payload: { ...fields, defect: Schema.optional(Schema.Boolean), succeed: Schema.optional(Schema.Boolean) },
		success: Schema.String,
	}),
);
const handlers = Api.toLayer({
	diagnose: (payload) =>
		Effect.gen(function* () {
			const diagnostic = { ...payload, sealed: Redacted.value(payload.sealed) };
			yield* Effect.logInfo("diagnostic").pipe(Effect.annotateLogs({ ...diagnostic, nested: diagnostic }));
			yield* Effect.annotateCurrentSpan({ ...diagnostic, nested: diagnostic });
			const span = yield* Effect.currentSpan.pipe(Effect.orDie);
			span.event("diagnostic", 0n, diagnostic);
			span.addLinks([{ attributes: diagnostic, span }]);
			if (payload.defect) {
				return yield* Effect.die(Object.assign(new Error("diagnostic defect"), diagnostic));
			}
			if (payload.succeed) {
				return payload.customerRef;
			}
			return yield* Effect.fail({ _tag: "Rejected" as const, ...payload, internalReference: 123_456_789 });
		}),
});

export const schemaDiagnostics = host.trait("configured", "RPC schemas and host keys declare sensitive diagnostics", (state) => {
	state.config.sensitiveKeys = ["customerRef"];
	state.build = () =>
		appHost({ config: state.config, group: Api, handlers, policy: "loopback", services: Layer.empty }).pipe(
			Layer.provide(ErrorReporter.layer([{ [ErrorReporter.TypeId]: ErrorReporter.TypeId, report: ({ cause }) => state.reported.push(cause) }])),
		);
});
