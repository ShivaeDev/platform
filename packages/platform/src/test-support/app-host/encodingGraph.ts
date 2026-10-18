import { Effect, Layer, Schema, SchemaGetter } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#server/appHost.ts";
import { host } from "./story.ts";

const UnionFailure = Schema.Struct({ contact: Schema.String.annotate({ sensitive: true }) }).pipe(
	Schema.encodeTo(Schema.Union([Schema.Struct({ wireContact: Schema.String }), Schema.Struct({ alternateContact: Schema.String })]), {
		decode: SchemaGetter.transform((value) => ({ contact: "wireContact" in value ? value.wireContact : value.alternateContact })),
		encode: SchemaGetter.transform(({ contact }) => (contact.startsWith("alternate") ? { alternateContact: contact } : { wireContact: contact })),
	}),
);
const unionApi = RpcGroup.make(Rpc.make("unionFailure", { error: UnionFailure, payload: { value: Schema.String }, success: Schema.Void }));
const unionHandlers = unionApi.toLayer({ unionFailure: ({ value }) => Effect.fail({ contact: value }) });
export const unionEncoding = host.trait("configured", "sensitive fields encode into a union of wire objects", (state) => {
	state.build = () => appHost({ config: state.config, group: unionApi, handlers: unionHandlers, policy: "loopback", services: Layer.empty });
});

const declaration = Rpc.make("declaration", { payload: { contact: Schema.String.annotate({ sensitive: true }) }, success: Schema.Void });
const mapped = Rpc.make("mapped", {
	error: Schema.Struct({ contact: Schema.String, visible: Schema.String }).pipe(Schema.encodeKeys({ contact: "wireContact" })),
	payload: { value: Schema.String },
	success: Schema.Void,
});
const firstLink = Rpc.make("firstLink", {
	error: Schema.Struct({ contact: Schema.String }).pipe(Schema.encodeKeys({ contact: "intermediateContact" })),
	payload: { value: Schema.String },
	success: Schema.Void,
});
const lastLink = Rpc.make("lastLink", {
	error: Schema.Struct({ intermediateContact: Schema.String, visible: Schema.String }).pipe(
		Schema.encodeKeys({ intermediateContact: "wireChainedContact" }),
	),
	payload: { value: Schema.String },
	success: Schema.Void,
});

export function declarationOrder(order: "first" | "last") {
	return host.trait("configured", `the sensitive declaration appears ${order} among RPC schemas`, (state) => {
		const group =
			order === "first" ? RpcGroup.make(declaration, mapped, lastLink, firstLink) : RpcGroup.make(firstLink, lastLink, mapped, declaration);
		const handlers = group.toLayer({
			declaration: () => Effect.void,
			firstLink: ({ value }) => Effect.fail({ contact: value }),
			lastLink: ({ value }) => Effect.fail({ intermediateContact: value, visible: "public detail" }),
			mapped: ({ value }) =>
				Effect.gen(function* () {
					const diagnostic = { contact: value, intermediateContact: value, visible: "public detail", wireChainedContact: value, wireContact: value };
					yield* Effect.logInfo("mapping diagnostic").pipe(Effect.annotateLogs(diagnostic));
					yield* Effect.annotateCurrentSpan(diagnostic);
					return yield* Effect.fail({ contact: value, visible: diagnostic.visible });
				}),
		});
		state.build = () => appHost({ config: state.config, group, handlers, policy: "loopback", services: Layer.empty });
	});
}
