import { inspect } from "node:util";
import { Cause, Effect, ErrorReporter, Exit, Layer } from "effect";
import { Headers } from "effect/http";
import { RpcTest } from "effect/rpc";
import { redactingErrorReporter } from "@shivaedev/errors/redactCause.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { betterAuthSessions } from "#server/adapters/betterAuthSessions.ts";
import { requestTracingLayer } from "#server/tracing.ts";
import { Crashes, Handlers, SECRETS } from "./defectFixture.ts";
import { recorder } from "./harness.ts";

type Kind = "an object defect" | "an error defect";

function described(defect: unknown) {
	if (defect instanceof Error) {
		return { cause: defect.cause, error: defect.name, message: defect.message, ...Object.fromEntries(Object.entries(defect)) };
	}
	if (typeof defect === "object" && defect !== null && "stack" in defect && "name" in defect) {
		const { name, stack: _stack, ...fields } = defect;
		return { error: name, ...fields };
	}
	return defect;
}

function squashed(cause: Cause.Cause<unknown> | undefined) {
	return cause === undefined ? "nothing" : described(Cause.squash(cause));
}

function secretsIn(value: unknown) {
	const text = inspect(value, { depth: 20 });
	return SECRETS.filter((secret) => text.includes(secret));
}

export const redaction = storyKit({
	clock: "live",
	create: () => {
		const reported: Cause.Cause<unknown>[] = [];
		const exits: Exit.Exit<void, unknown>[] = [];
		return { ...recorder(), exits, reported };
	},
	name: "RPC redaction",
	stages: [],
	verbs: (state, story) => {
		function errorLogs() {
			return state.logs.filter((log) => log.level === "Error");
		}
		function serverSpans() {
			return state.spans.filter((span) => span.kind === "server" && span.name === "Crash");
		}
		return {
			crash: (kind: Kind) =>
				Effect.gen(function* () {
					story.tell(`a handler dies with ${kind} that carries secrets`);
					const client = yield* RpcTest.makeClient(Crashes);
					state.exits.push(yield* Effect.exit(client.Crash({ kind })));
				}).pipe(
					Effect.provide(Layer.mergeAll(Handlers, requestTracingLayer(), state.layer, ErrorReporter.layer([recordedReporter(state.reported)]))),
					Effect.scoped,
				),
			defectInServerSpan: () =>
				Effect.sync(() =>
					serverSpans().map((span) =>
						span.status._tag === "Ended" && Exit.isFailure(span.status.exit) ? squashed(span.status.exit.cause) : "not failed",
					),
				),
			defectLogged: () =>
				Effect.sync(() =>
					errorLogs().map((log) => {
						const defect = log.annotations["rpc.defect"];
						return Array.isArray(defect) ? defect.map(described) : defect;
					}),
				),
			defectReported: () => Effect.sync(() => state.reported.map(squashed)),
			defectSeenByClient: () => Effect.sync(() => state.exits.map((exit) => squashed(Exit.isFailure(exit) ? exit.cause : undefined))),
			providerFails: () => {
				story.tell("the session provider fails with an error that carries a session cookie");
				const failing = betterAuthSessions(() => Promise.reject(Object.assign(new Error("database closed"), { cookie: "session=cookie-plaintext" })));
				return Effect.exit(failing.get(Headers.empty)).pipe(Effect.provide(state.layer), Effect.asVoid);
			},
			providerFailureLogged: () =>
				Effect.sync(() =>
					errorLogs().map((log) => {
						const [message, cause] = Array.isArray(log.message) ? log.message : [log.message];
						return { cookie: cause?.cookie, logged: message, message: cause?.message };
					}),
				),
			report: (defect: Error) =>
				Effect.gen(function* () {
					story.tell("an external error passes through the redacting error reporter");
					const reported: Array<{ attributes: unknown; message: string; severity: string }> = [];
					const inner = ErrorReporter.make(({ error, severity, attributes }) => {
						reported.push({ attributes, message: error.message, severity });
					});
					yield* Effect.withFiber((fiber) =>
						Effect.sync(() => redactingErrorReporter(inner).report({ cause: Cause.die(defect), fiber, timestamp: 0n })),
					);
					return reported;
				}),
			secretsSeen: () =>
				Effect.sync(() => ({
					client: secretsIn(state.exits),
					"error reporter": secretsIn(state.reported),
					logs: secretsIn(state.logs),
					"server span": secretsIn(serverSpans().map((span) => [span.status, span.events, span.attributes])),
				})),
		};
	},
});

function recordedReporter(reported: Cause.Cause<unknown>[]) {
	return ErrorReporter.make(({ cause }) => {
		reported.push(cause);
	});
}
