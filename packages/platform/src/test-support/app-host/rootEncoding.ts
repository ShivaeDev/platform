import { Cause, Effect, Layer, Schema, SchemaGetter } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#server/appHost.ts";
import { host } from "./story.ts";

export function rootEncoding(source: "schema" | "host", shape: "scalar" | "record") {
	return host.trait("configured", `a sensitive ${source} field encodes to a root ${shape}`, (state) => {
		const Contact = source === "schema" ? Schema.String.annotate({ sensitive: true }) : Schema.String;
		const Source = Schema.Struct({ contact: Contact, slot: Schema.String });
		const errors = {
			record: Source.pipe(
				Schema.encodeTo(Schema.Record(Schema.String, Schema.String), {
					decode: SchemaGetter.transform((record) => ({ contact: Object.values(record)[0] ?? "", slot: Object.keys(record)[0] ?? "" })),
					encode: SchemaGetter.transform(({ contact, slot }) => ({ [slot]: contact })),
				}),
			),
			scalar: Source.pipe(
				Schema.encodeTo(Schema.String, {
					decode: SchemaGetter.transform((contact) => ({ contact, slot: "unused" })),
					encode: SchemaGetter.transform(({ contact }) => contact),
				}),
			),
		};
		const group = RpcGroup.make(
			Rpc.make("hidden", { error: errors[shape], payload: { contact: Schema.String, slot: Schema.String }, success: Schema.Void }),
			Rpc.make("visibleFailure", { error: Schema.Struct({ detail: Schema.String }), payload: { detail: Schema.String }, success: Schema.Void }),
			Rpc.make("succeed", { payload: { contact: Schema.String }, success: Schema.String }),
		);
		const handlers = group.toLayer({
			hidden: (payload) => Effect.fail(payload),
			succeed: ({ contact }) => Effect.succeed(contact),
			visibleFailure: (payload) => Effect.fail(payload),
		});
		state.config.sensitiveKeys = source === "host" ? ["contact"] : [];
		state.build = () => appHost({ config: state.config, group, handlers, policy: "loopback", services: Layer.empty });
	});
}

const defects = RpcGroup.make(
	Rpc.make("hiddenDefect", {
		defect: Schema.Unknown.annotate({ sensitive: true }),
		payload: { interrupt: Schema.Boolean, value: Schema.String },
		success: Schema.Void,
	}),
);
const defectHandlers = defects.toLayer({
	hiddenDefect: ({ interrupt, value }) => Effect.failCause(interrupt ? Cause.combine(Cause.die(value), Cause.interrupt(123)) : Cause.die(value)),
});
export const rootDefect = host.trait("configured", "an RPC declares its whole defect value sensitive", (state) => {
	state.build = () => appHost({ config: state.config, group: defects, handlers: defectHandlers, policy: "loopback", services: Layer.empty });
});
