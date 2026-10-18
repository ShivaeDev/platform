import { Effect, ManagedRuntime } from "effect";
import { HttpBody, HttpClient } from "effect/http";
import { otlpHttpClient } from "#server/otlpHttpClient.ts";
import { requests } from "./requests.ts";
import { type HostState, io } from "./state.ts";

function until(observed: () => boolean, timeout: number) {
	return Effect.gen(function* () {
		while (!observed()) {
			yield* Effect.sleep("10 millis");
		}
	}).pipe(Effect.timeout(timeout));
}

export function timeoutVerbs(state: HostState, tell: (line: string) => void) {
	return {
		exportTrace: (name: string) =>
			requests(state, tell)
				.request(`/trace/${encodeURIComponent(name)}`)
				.pipe(
					Effect.flatMap((response) => (response.status === 200 ? Effect.void : Effect.fail(new Error(`Trace route returned ${response.status}`)))),
				),
		probeCollector: (timeout: number) =>
			io(async () => {
				tell("the native OTLP HTTP client waits for the collector");
				const runtime = ManagedRuntime.make(otlpHttpClient(timeout));
				try {
					return await runtime.runPromise(
						HttpClient.post(`${state.receiver?.url ?? ""}/v1/traces`, { body: HttpBody.jsonUnsafe({ resourceSpans: [] }) }).pipe(
							Effect.flip,
							Effect.timeout(1000),
						),
					);
				} finally {
					await runtime.dispose();
				}
			}),
		waitForExport: (name: string) => until(() => state.receiver?.requests.some(({ body }) => body.includes(name)) ?? false, 500),
		waitForExports: (count: number) => until(() => state.receiver?.requests.length === count, 500),
		waitForWarning: (timeout: number) => until(() => state.logs.some(({ level }) => level === "Warn"), timeout),
	};
}
