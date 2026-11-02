import { createServer, type IncomingHttpHeaders } from "node:http";
import * as Effect from "effect/Effect";
import type { OtlpTracer } from "effect/observability";
import { receiveOtlp } from "#adapters/receiveOtlp.ts";
import { loopbackServer } from "#internal/loopback.ts";
import type { otlpReadout } from "#internal/otlpReadout.ts";
import { recordedSignals } from "#internal/recordedSignals.ts";
import { type UntilOptions, until } from "#until.ts";

export type OtlpSpan = ReturnType<typeof otlpReadout>[number];
export type OtlpTracerOptions = Omit<Parameters<typeof OtlpTracer.layer>[0], "url" | "compression">;
export interface OtlpExport {
	readonly body: Buffer;
	readonly headers: IncomingHttpHeaders;
	readonly path: string | undefined;
	readonly rawHeaders: readonly string[];
}
export interface OtlpReceiverOptions {
	readonly answer?: string | null;
	readonly path?: string;
	readonly status?: number | ((attempt: number) => number | undefined);
}

export const otlpReceiver = Effect.fnUntraced(function* (options: OtlpReceiverOptions = {}) {
	const requests: OtlpExport[] = [];
	const signals = recordedSignals<OtlpSpan>();
	const server = createServer((request, response) => receiveOtlp(request, response, requests, signals.push, options));
	const url = yield* loopbackServer(server);
	const { otlpTracing } = yield* Effect.promise(() => import("#internal/otlpTracing.ts"));
	const { errors, exportsSecret, queries } = yield* Effect.promise(() => import("#internal/otlpReadouts.ts"));
	yield* Effect.addFinalizer(() => Effect.sync(() => signals.end()));
	return {
		...otlpTracing(`${url}${options.path ?? "/v1/traces"}`, signals.stream),
		errors: () => errors(signals.values),
		exportsSecret: (secret: string) => exportsSecret(requests, secret),
		queries: () => queries(signals.values),
		get requests(): readonly OtlpExport[] {
			return requests;
		},
		get spans(): readonly OtlpSpan[] {
			return signals.values;
		},
		untilSpan: (matches: (span: OtlpSpan) => boolean, wait: UntilOptions) => until(signals.stream, matches, wait),
		url,
	};
});
