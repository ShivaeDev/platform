import type { IncomingMessage, ServerResponse } from "node:http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { OtlpExport, OtlpReceiverOptions, OtlpSpan } from "#otlpReceiver.ts";

export async function receiveOtlp(
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
		const { otlpReadout } = await import("#internal/otlpReadout.ts");
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
