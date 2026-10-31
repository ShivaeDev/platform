import { Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup, RpcMiddleware } from "effect/rpc";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { appHost } from "#appHost.ts";
import { ambiguous, scoped } from "./fieldScopeApi.ts";
import { host } from "./story.ts";

function diagnostic(name: string, state: string) {
	return Effect.logInfo(name).pipe(Effect.annotateLogs({ state }), Effect.andThen(Effect.annotateCurrentSpan({ state })));
}
const scopedHandlers = scoped.toLayer({
	privateState: ({ fail }) =>
		diagnostic("private state", "private-state").pipe(
			Effect.andThen(fail ? Effect.fail(new Conflict({ message: "Private call rejected" })) : Effect.succeed({ state: "private-state" as const })),
		),
	publicState: ({ fail }) =>
		diagnostic("public state", "active").pipe(
			Effect.andThen(fail ? Effect.fail({ _tag: "Blocked" as const, state: "active" as const }) : Effect.succeed({ state: "active" as const })),
		),
});
const ambiguousHandlers = ambiguous.toLayer({
	ambiguousState: ({ fail }) =>
		fail ? Effect.fail({ _tag: "Blocked" as const, state: "active" as const }) : Effect.succeed({ state: "private-state" as const }),
});

export const scopedFields = host.trait("configured", "separate RPC schemas use private and public state fields", (state) => {
	state.build = () => appHost({ config: state.config, group: scoped, handlers: scopedHandlers, policy: "loopback", services: Layer.empty });
});
export const ambiguousFields = host.trait("configured", "one RPC uses state privately in its success and publicly in its failure", (state) => {
	state.build = () => appHost({ config: state.config, group: ambiguous, handlers: ambiguousHandlers, policy: "loopback", services: Layer.empty });
});

export function conflictingFields(kind: "nested" | "record" | "encoded" | "selfEncoded" | "middleware") {
	return host.trait("configured", `a ${kind} schema reuses a sensitive field publicly in the same RPC`, (state) => {
		const PrivateState = Schema.Struct({ state: Schema.String.annotate({ sensitive: true }) });
		const successes = {
			encoded: PrivateState.pipe(Schema.encodeKeys({ state: "wireState" })),
			middleware: PrivateState,
			nested: Schema.Struct({ private: PrivateState, public: Schema.Struct({ state: Schema.String }) }),
			record: Schema.Struct({ private: PrivateState, public: Schema.Record(Schema.String, Schema.String) }),
			selfEncoded: Schema.Struct({ state: Schema.String.annotate({ sensitive: true }), visible: Schema.String }).pipe(
				Schema.encodeKeys({ state: "wireState" }),
			),
		};
		const success = successes[kind];
		const group = RpcGroup.make(
			Rpc.make("conflictingState", { error: kind === "encoded" ? Schema.Struct({ wireState: Schema.String }) : Schema.Never, success }),
		);
		class PublicStateMiddleware extends RpcMiddleware.Service<PublicStateMiddleware>()("PublicStateMiddleware", {
			error: kind === "middleware" ? Schema.Struct({ state: Schema.String }) : Schema.Never,
		}) {}
		const api = group.middleware(PublicStateMiddleware);
		const handlers = Layer.merge(
			api.toLayer({ conflictingState: () => Effect.never }),
			Layer.succeed(PublicStateMiddleware, (effect) => effect),
		);
		state.build = () => appHost({ config: state.config, group: api, handlers, policy: "loopback", services: Layer.empty });
	});
}
