import { Context, Effect, Layer, Logger, ManagedRuntime, Option } from "effect";
import { HttpClient } from "effect/http";
import { OtlpExporter, type OtlpTracer } from "effect/observability";
import { otlpHttpClient } from "#otlpHttpClient.ts";
import { type HostState, io, runtimeOf } from "./state.ts";

export function traceVerbs(state: HostState) {
	return {
		collectorResponses: (statuses: readonly number[]) => io(() => collectorResponses(state, statuses)),
		exportedSpans: () => {
			const payloads: OtlpTracer.TraceData[] = (state.receiver?.requests ?? []).map(({ body }) => JSON.parse(body));
			return payloads.flatMap(({ resourceSpans }) => resourceSpans.flatMap(({ scopeSpans }) => scopeSpans.flatMap(({ spans }) => spans)));
		},
		exports: () => state.receiver?.requests ?? [],
		flush: () =>
			io(async () => {
				const runtime = runtimeOf(state);
				const context = await runtime.runPromise(Effect.context());
				await runtime.runPromise(Option.getOrThrow(Context.getOption(context, OtlpExporter.Flusher)).flush);
			}),
		logs: () => state.logs,
	};
}

async function collectorResponses(state: HostState, statuses: readonly number[]) {
	const counts: number[] = [];
	const logger = Logger.make((options) => {
		state.logs.push({ annotations: {}, attempt: state.receiver?.requests.length ?? 0, level: options.logLevel, message: options.message });
	});
	const runtime = ManagedRuntime.make(otlpHttpClient.pipe(Layer.provideMerge(Logger.layer([logger]))));
	try {
		for (const status of statuses) {
			const response = await runtime.runPromise(Effect.flatMap(HttpClient.HttpClient, (client) => client.get(state.receiver?.url ?? "")));
			if (response.status !== status) {
				throw new Error(`Collector returned ${response.status}, expected ${status}`);
			}
			counts.push(state.logs.filter(({ level }) => level === "Warn").length);
		}
		return counts;
	} finally {
		await runtime.dispose();
	}
}
