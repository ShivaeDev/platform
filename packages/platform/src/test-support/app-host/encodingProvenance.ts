import { Effect, Layer, Schema, SchemaGetter } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#server/appHost.ts";
import { host } from "./story.ts";

const BranchFailure = Schema.Struct({ contact: Schema.String.annotate({ sensitive: true }), other: Schema.String, swap: Schema.Boolean }).pipe(
	Schema.encodeTo(Schema.Struct({ left: Schema.String, right: Schema.String, swap: Schema.Boolean }), {
		decode: SchemaGetter.transform(({ left, right, swap }) => ({ contact: swap ? right : left, other: swap ? left : right, swap })),
		encode: SchemaGetter.transform(({ contact, other, swap }) => ({ left: swap ? other : contact, right: swap ? contact : other, swap })),
	}),
);
const branchApi = RpcGroup.make(
	Rpc.make("branched", { error: BranchFailure, payload: { swap: Schema.Boolean, value: Schema.String }, success: Schema.Void }),
);
const branchHandlers = branchApi.toLayer({
	branched: ({ swap, value }) =>
		Effect.gen(function* () {
			const diagnostic = { left: swap ? "public detail" : value, right: swap ? value : "public detail", visible: "public control" };
			yield* Effect.logInfo("branched diagnostic").pipe(Effect.annotateLogs(diagnostic));
			yield* Effect.annotateCurrentSpan(diagnostic);
			return yield* Effect.fail({ contact: value, other: "public detail", swap });
		}),
});
export const branchedEncoding = host.trait("configured", "a boolean changes which encoded field carries a sensitive value", (state) => {
	state.build = () => appHost({ config: state.config, group: branchApi, handlers: branchHandlers, policy: "loopback", services: Layer.empty });
});

export function scalarEncoding(source: "schema" | "host") {
	return host.trait("configured", `a nested ${source} declaration encodes as a scalar`, (state) => {
		const Contact = source === "schema" ? Schema.String.annotate({ sensitive: true }) : Schema.String;
		const Profile = Schema.Struct({ contact: Contact }).pipe(
			Schema.encodeTo(Schema.String, {
				decode: SchemaGetter.transform((contact) => ({ contact })),
				encode: SchemaGetter.transform(({ contact }) => contact),
			}),
		);
		const group = RpcGroup.make(
			Rpc.make("scalar", {
				error: Schema.Struct({ profile: Profile, visible: Schema.String }),
				payload: { value: Schema.String },
				success: Schema.Void,
			}),
		);
		const handlers = group.toLayer({
			scalar: ({ value }) =>
				Effect.gen(function* () {
					const diagnostic = { profile: value, visible: "public control" };
					yield* Effect.logInfo("scalar diagnostic").pipe(Effect.annotateLogs(diagnostic));
					yield* Effect.annotateCurrentSpan(diagnostic);
					return yield* Effect.fail({ profile: { contact: value }, visible: diagnostic.visible });
				}),
		});
		state.config.sensitiveKeys = source === "host" ? ["contact"] : [];
		state.build = () => appHost({ config: state.config, group, handlers, policy: "loopback", services: Layer.empty });
	});
}
