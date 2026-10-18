import { Effect, Layer } from "effect";
import { Headers } from "effect/http";
import { Rpc, RpcMessage, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { RequestTracing } from "#rpc/middleware.ts";
import { type RequestTracingOptions, requestTracingLayer } from "#rpc-server/tracing.ts";
import { annotationsOf, recorder } from "./harness.ts";
import { Accounts, Handlers, registration } from "./tracingFixture.ts";

const openTracing = Effect.fnUntraced(function* (options: RequestTracingOptions, recorded: ReturnType<typeof recorder>) {
	const services = yield* Layer.build(Layer.mergeAll(Handlers, requestTracingLayer(options), recorded.layer));
	const client = yield* RpcTest.makeClient(Accounts).pipe(Effect.provide(services));
	return { client, services };
});

const cancelRequest = Effect.fnUntraced(function* () {
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
});

export const tracing = storyKit({
	after: {
		*configured(state) {
			state.connection.current = yield* openTracing(state.options, state);
		},
	},
	clock: "live",
	create: () => {
		const connection: { current?: Effect.Success<ReturnType<typeof openTracing>> } = {};
		const options: RequestTracingOptions = {};
		return { ...recorder(), connection, options };
	},
	inspect: ({ logs }) => ({ annotations: logs.map((log) => log.annotations) }),
	name: "RPC tracing",
	stages: ["configured"],
	verbs: (state, story) => {
		function call<A, E, R>(run: (client: import("effect/rpc").RpcClient.FromGroup<typeof Accounts>) => Effect.Effect<A, E, R>) {
			const connection = state.connection.current;
			if (connection === undefined) {
				throw new Error("RPC tracing has not been configured");
			}
			return run(connection.client).pipe(Effect.provide(connection.services));
		}
		return {
			annotations: (message: string) => annotationsOf(state.logs, message),
			cancel: () => {
				story.tell("the caller cancels a request");
				return call(cancelRequest);
			},
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
