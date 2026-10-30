import { Cause, Context, Effect, Layer, Logger, ManagedRuntime, Option } from "effect";
import { HttpBody, HttpClient } from "effect/http";
import { OtlpExporter } from "effect/observability";
import { otlpHttpClient } from "#otlpHttpClient.ts";
import { type HostState, io, runtimeOf } from "./state.ts";

export function traceVerbs(state: HostState) {
	return {
		collectorResponses: (statuses: readonly number[]) => io(() => collectorResponses(state, statuses)),
		diagnosticSinks: (name: string) =>
			Effect.sync(() => ({
				log: state.logs.find((log) => Array.isArray(log.message) && log.message.includes(name))?.annotations,
				report: state.reported.map((cause) => Option.getOrUndefined(Cause.findErrorOption(cause)))[0],
				span: Object.fromEntries(
					(state.receiver?.spans.find((span) => span.name === name)?.attributes ?? []).map(({ key, value }) => [
						key,
						value.arrayValue ? value.arrayValue.values?.map((item) => item.stringValue) : value.stringValue,
					]),
				),
			})),
		exportedSpans: () => state.receiver?.spans ?? [],
		exports: () => state.receiver?.requests ?? [],
		flush: () =>
			io(async () => {
				const runtime = runtimeOf(state);
				const context = await runtime.runPromise(Effect.context());
				await runtime.runPromise(Option.getOrThrow(Context.getOption(context, OtlpExporter.Flusher)).flush);
			}),
		logs: () => state.logs,
		nativeSpans: () => state.nativeSpans,
		reportedCauses: () => state.reported,
	};
}

async function collectorResponses(state: HostState, statuses: readonly number[]) {
	const counts: number[] = [];
	const logger = Logger.make((options) => {
		state.logs.push({ annotations: {}, attempt: state.receiver?.requests.length ?? 0, level: options.logLevel, message: options.message });
	});
	const runtime = ManagedRuntime.make(otlpHttpClient().pipe(Layer.provideMerge(Logger.layer([logger]))));
	try {
		for (const status of statuses) {
			const response = await runtime.runPromise(
				Effect.flatMap(HttpClient.HttpClient, (client) =>
					client.post(`${state.receiver?.url ?? ""}/v1/traces`, { body: HttpBody.jsonUnsafe({ resourceSpans: [] }) }),
				),
			);
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
