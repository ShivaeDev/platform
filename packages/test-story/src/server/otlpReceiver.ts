import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { loopbackServer } from "#internal/loopback.ts";
import { otlpReadout } from "#internal/otlpReadout.ts";
import { recordedSignals } from "#internal/recordedSignals.ts";
import { type UntilOptions, until } from "#until.ts";

export type OtlpSpan = ReturnType<typeof otlpReadout>[number];
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

async function receive(
	request: IncomingMessage,
	response: ServerResponse,
	requests: OtlpExport[],
	record: (span: OtlpSpan) => void,
	options: OtlpReceiverOptions,
) {
	try {
		const chunks: Buffer[] = [];
		for await (const chunk of request) {
			chunks.push(Buffer.from(chunk));
		}
		const body = Buffer.concat(chunks);
		requests.push({ body, headers: request.headers, path: request.url, rawHeaders: request.rawHeaders });
		if (request.method !== "POST" || request.url !== (options.path ?? "/v1/traces")) {
			response.writeHead(HttpStatus.fromLiteral("NotFound")).end();
			return;
		}
		const contentType = request.headers["content-type"]?.split(";")[0]?.trim();
		if (contentType !== "application/json" && contentType !== "application/x-protobuf") {
			response.writeHead(HttpStatus.fromLiteral("UnsupportedMediaType")).end();
			return;
		}
		for (const span of otlpReadout(body, contentType)) {
			record(span);
		}
		const status = typeof options.status === "function" ? options.status(requests.length) : (options.status ?? HttpStatus.fromLiteral("OK"));
		if (status === undefined) {
			return;
		}
		response.writeHead(status);
		if (options.answer === null) {
			response.flushHeaders();
		} else {
			response.end(options.answer ?? "{}");
		}
	} catch {
		response.writeHead(HttpStatus.fromLiteral("BadRequest")).end();
	}
}

export const otlpReceiver = Effect.fnUntraced(function* (options: OtlpReceiverOptions = {}) {
	const requests: OtlpExport[] = [];
	const signals = recordedSignals<OtlpSpan>();
	const server = createServer((request, response) => receive(request, response, requests, signals.push, options));
	const url = yield* loopbackServer(server);
	yield* Effect.addFinalizer(() => Effect.sync(() => signals.end()));
	return {
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
