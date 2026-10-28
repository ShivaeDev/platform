import { Cause, Effect, Exit, Layer } from "effect";
import { Headers } from "effect/http";
import { Rpc, type RpcClient, RpcMessage, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { RequestTracing } from "#middleware.ts";
import { type RequestTracingOptions, requestTracingLayer } from "#server/tracing.ts";
import { annotationsOf, recorder } from "./harness.ts";
import { rejectionAnswer } from "./rejectionAnswer.ts";
import { Accounts, Handlers, REGISTRATION_SECRETS, registration } from "./tracingFixture.ts";

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

const GENERATED_ID = /^[0-9a-f]{32}$/u;

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
		const generated: string[] = [];
		const rejected: { error?: unknown } = {};
		return { ...recorder(), connection, generated, options, rejected };
	},
	inspect: ({ logs }) => ({ annotations: logs.map((log) => log.annotations) }),
	name: "RPC tracing",
	stages: ["configured"],
	verbs: (state, story) => {
		function call<A, E, R>(run: (client: RpcClient.FromGroup<typeof Accounts>) => Effect.Effect<A, E, R>) {
			const connection = state.connection.current;
			if (connection === undefined) {
				throw new Error("RPC tracing has not been configured");
			}
			return run(connection.client).pipe(Effect.provide(connection.services));
		}
		function labelled(requestId: string, sent: string | undefined) {
			if (requestId === sent || !GENERATED_ID.test(requestId)) {
				return requestId;
			}
			if (!state.generated.includes(requestId)) {
				state.generated.push(requestId);
			}
			return `generated id ${state.generated.indexOf(requestId) + 1}`;
		}
		function failureLogs() {
			return annotationsOf(state.logs, "RPC failure");
		}
		function defectLogs() {
			return annotationsOf(state.logs, "RPC defect");
		}
		return {
			cancel: () => {
				story.tell("the caller cancels a request whose payload carries a password");
				return call(cancelRequest).pipe(
					Effect.map((exit) => (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause) ? "interrupted" : `ended: ${String(exit)}`)),
				);
			},
			crash: () => {
				story.tell("the caller sends the registration with secrets to an operation that dies");
				return call((client) => Effect.exit(client.Crash(registration))).pipe(Effect.asVoid);
			},
			defectLogs: () =>
				Effect.sync(() => defectLogs().map((annotations) => ({ method: annotations["rpc.method"], payload: annotations["rpc.payload"] }))),
			echo: (requestId?: string, header = "x-request-id") => {
				story.tell(
					requestId === undefined ? "the caller sends a request without a request id" : `the caller sends ${header}: ${JSON.stringify(requestId)}`,
				);
				return call((client) => client.Echo(undefined, { headers: requestId === undefined ? {} : { [header]: requestId } })).pipe(
					Effect.map((seen) => labelled(seen, requestId)),
				);
			},
			echoLogs: () => Effect.sync(() => annotationsOf(state.logs, "echo")),
			externalRejection: () => {
				story.tell("the caller invokes an operation that rejects with a plain string from an external service");
				return call((client) => Effect.flip(client.ExternalRejection()));
			},
			failureLogPayloads: () => Effect.sync(() => failureLogs().map((annotations) => annotations["rpc.payload"])),
			failureLogs: () =>
				Effect.sync(() => failureLogs().map((annotations) => ({ failure: annotations["rpc.failure"], method: annotations["rpc.method"] }))),
			register: () => {
				story.tell("the caller registers alice with an email that is already registered, sending secrets in the payload");
				return Effect.gen(function* () {
					state.rejected.error = yield* call((client) => Effect.flip(client.Register(registration)));
				});
			},
			rejection: () => Effect.sync(() => rejectionAnswer(state.rejected.error)),
			secretsInLogs: () =>
				Effect.sync(() => {
					const serialized = JSON.stringify(state.logs.map((log) => log.annotations));
					return REGISTRATION_SECRETS.filter((secret) => serialized.includes(secret));
				}),
			serverSpanAttributes: () =>
				Effect.sync(() =>
					state.spans
						.filter((span) => span.kind === "server" && span.name === "Echo")
						.map((span) => ({ "request.id": span.attributes.get("request.id"), "rpc.method": span.attributes.get("rpc.method") })),
				),
		};
	},
});
export function tracePolicy(line: string, options: RequestTracingOptions) {
	return tracing.trait("configured", line, (state) => {
		state.options = options;
	});
}
