import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import { Effect } from "effect";
import { loopbackServer } from "#internal/loopback.ts";
import { otlpReadout } from "#internal/otlpReadout.ts";

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

async function receive(request: IncomingMessage, response: ServerResponse, requests: OtlpExport[], spans: OtlpSpan[], options: OtlpReceiverOptions) {
	try {
		const chunks: Buffer[] = [];
		for await (const chunk of request) {
			chunks.push(Buffer.from(chunk));
		}
		const body = Buffer.concat(chunks);
		requests.push({ body, headers: request.headers, path: request.url, rawHeaders: request.rawHeaders });
		if (request.method !== "POST" || request.url !== (options.path ?? "/v1/traces")) {
			response.writeHead(404).end();
			return;
		}
		const contentType = request.headers["content-type"]?.split(";")[0]?.trim();
		if (contentType !== "application/json" && contentType !== "application/x-protobuf") {
			response.writeHead(415).end();
			return;
		}
		spans.push(...otlpReadout(body, contentType));
		const status = typeof options.status === "function" ? options.status(requests.length) : (options.status ?? 200);
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
		response.writeHead(400).end();
	}
}

export const otlpReceiver = Effect.fnUntraced(function* (options: OtlpReceiverOptions = {}) {
	const requests: OtlpExport[] = [];
	const spans: OtlpSpan[] = [];
	const server = createServer((request, response) => receive(request, response, requests, spans, options));
	const url = yield* loopbackServer(server);
	const receiver: { readonly requests: readonly OtlpExport[]; readonly spans: readonly OtlpSpan[]; readonly url: string } = {
		requests,
		spans,
		url,
	};
	return receiver;
});
