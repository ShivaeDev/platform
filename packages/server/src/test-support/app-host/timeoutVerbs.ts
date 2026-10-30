import { Effect, Exit, Fiber, ManagedRuntime } from "effect";
import { HttpBody, HttpClient, HttpClientError } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { TestClock } from "effect/testing";
import { otlpHttpClient } from "#otlpHttpClient.ts";
import { causeWords, words } from "#test/answers.ts";
import { close } from "./lifecycle.ts";
import { requests } from "./requests.ts";
import { type HostState, io, logged } from "./state.ts";

function receiverOf(state: HostState) {
	if (state.receiver === undefined) {
		throw new Error("Declare a collector before waiting for its exports");
	}
	return state.receiver;
}

function warned(state: HostState) {
	return state.logs.some(({ level }) => level === "Warn");
}

export function timeoutVerbs(state: HostState, tell: (line: string) => void) {
	let closing: Fiber.Fiber<void, unknown> | undefined;
	return {
		exportArrives: (name: string) => {
			tell(`the collector receives the export containing ${name}`);
			return io(() => receiverOf(state).whenReceived((exports) => exports.some(({ body }) => body.includes(name))));
		},
		exportDeadlineNearlyPasses: (timeout: number) => {
			tell(`${timeout - 1} ms pass while the collector holds the first export`);
			return TestClock.adjust(timeout - 1);
		},
		exportDeadlinePasses: () => {
			tell("the last millisecond of the export timeout passes and the host warns");
			return TestClock.adjust(1).pipe(Effect.andThen(io(() => logged(state, () => warned(state)))));
		},
		firstExportArrives: () => {
			tell("the collector receives the host's first export");
			return io(() => receiverOf(state).whenReceived((exports) => exports.length > 0));
		},
		probeCollector: (timeout: number) => {
			tell(`the native OTLP HTTP client posts to the collector with a ${timeout} ms timeout`);
			return io(async () => {
				const runtime = ManagedRuntime.make(otlpHttpClient(timeout));
				try {
					const exit = await runtime.runPromiseExit(
						HttpClient.post(`${receiverOf(state).url}/v1/traces`, { body: HttpBody.jsonUnsafe({ resourceSpans: [] }) }),
					);
					return Exit.isSuccess(exit) ? `answered ${exit.value.status}` : causeWords(exit.cause, transportWords);
				} finally {
					await runtime.dispose();
				}
			});
		},
		shutdownBegins: () => {
			tell("the app host starts shutting down while the collector holds the export");
			return Effect.gen(function* () {
				closing = yield* close(state).pipe(Effect.forkDetach);
				yield* io(() => receiverOf(state).whenReceived((exports) => exports.length > 0));
			});
		},
		shutdownProgress: () =>
			Effect.sync(() => {
				if (closing === undefined) {
					return "not shutting down";
				}
				return closing.pollUnsafe() === undefined ? "still shutting down" : "shut down";
			}),
		shutdownTimeoutPasses: (timeout: number) => {
			tell(`the ${timeout} ms batch export timeout passes`);
			return Effect.gen(function* () {
				yield* TestClock.adjust(timeout);
				if (closing !== undefined) {
					yield* Fiber.await(closing);
				}
			});
		},
		traceRequest: (name: string) =>
			requests(state, tell)
				.request(`/trace/${encodeURIComponent(name)}`)
				.pipe(
					Effect.flatMap((response) =>
						response.status === HttpStatus.fromLiteral("OK") ? Effect.void : Effect.fail(new Error(`Trace route returned ${response.status}`)),
					),
				),
	};
}

function transportWords(error: unknown) {
	return HttpClientError.isHttpClientError(error) ? `${words(error.reason._tag)}: ${error.reason.description ?? "no description"}` : String(error);
}
