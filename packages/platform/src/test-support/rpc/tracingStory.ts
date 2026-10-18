import { Effect, Layer } from "effect";
import { Headers } from "effect/http";
import { Rpc, RpcMessage, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { RequestTracing } from "#rpc/middleware.ts";
import { type RequestTracingOptions, requestTracingLayer } from "#rpc-server/tracing.ts";
import { annotationsOf, recorder } from "./harness.ts";
import { Accounts, Handlers, registration } from "./tracingFixture.ts";

export const tracing = storyKit({
	clock: "live",
	create: () => {
		const options: RequestTracingOptions = {};
		return { ...recorder(), options };
	},
	inspect: ({ logs }) => ({ annotations: logs.map((log) => log.annotations) }),
	name: "RPC tracing",
	stages: ["configured"],
	verbs: (state, story) => {
		function call<A, E>(run: (client: import("effect/rpc").RpcClient.FromGroup<typeof Accounts>) => Effect.Effect<A, E>) {
			return Effect.gen(function* () {
				const client = yield* RpcTest.makeClient(Accounts);
				return yield* run(client);
			}).pipe(Effect.provide(Layer.mergeAll(Handlers, requestTracingLayer(state.options), state.layer)), Effect.scoped);
		}
		return {
			annotations: (message: string) => annotationsOf(state.logs, message),
			cancel: () =>
				Effect.gen(function* () {
					story.tell("the caller cancels a request");
					const middleware = yield* RequestTracing;
					return yield* Effect.exit(
						middleware(Effect.interrupt, {
							client: new Rpc.ServerClient(1),
							headers: Headers.empty,
							payload: { password: "cancelled-secret" },
							requestId: RpcMessage.RequestId(1),
							rpc: Rpc.make("Cancelled"),
						}),
					);
				}).pipe(Effect.provide(Layer.mergeAll(requestTracingLayer(state.options), state.layer))),
			crash: () => {
				story.tell("the caller triggers a defect");
				return call((client) => Effect.exit(client.Crash(registration)));
			},
			echo: (headers: Record<string, string> = {}) => {
				story.tell("the caller echoes a request id");
				return call((client) => client.Echo(undefined, { headers }));
			},
			externalRejection: () => call((client) => Effect.flip(client.ExternalRejection())),
			logs: () => state.logs,
			register: () => {
				story.tell("the caller registers an account");
				return call((client) => Effect.flip(client.Register(registration)));
			},
			spans: () => state.spans,
		};
	},
});
export function tracePolicy(options: RequestTracingOptions) {
	return tracing.trait("configured", "the application configures request tracing", (state) => {
		state.options = options;
	});
}
