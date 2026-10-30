import { brotliCompress, constants, gzip } from "node:zlib";
import { Effect } from "effect";
import { HttpBody, type HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";

type Encoding = "br" | "gzip";

const COMPRESSIBLE = /^(?:text\/(?:html|css|javascript)|application\/(?:json|(?:x-)?ndjson|javascript))(?:;|$)/u;
const MIN_BYTES = 256;
const CACHED_ENCODINGS = 256;

export function acceptedEncoding(header: string | undefined): Encoding | undefined {
	const weights = new Map<string, number>();
	for (const part of (header ?? "").toLowerCase().split(",")) {
		const [name = "", ...parameters] = part.split(";").map((value) => value.trim());
		const quality = parameters.find((parameter) => parameter.startsWith("q="));
		weights.set(name, quality ? Number(quality.slice(2)) : 1);
	}
	const wildcard = weights.get("*");
	return (["br", "gzip"] as const).find((encoding) => (weights.get(encoding) ?? wildcard ?? 0) > 0);
}

function compress(body: Uint8Array, encoding: Encoding) {
	return Effect.callback<Uint8Array>((resume) => {
		// zlib rejects only invalid options or exhausted memory, neither of which a request can cause.
		function done(error: Error | null, result: Uint8Array) {
			resume(error ? Effect.die(error) : Effect.succeed(result));
		}
		if (encoding === "br") {
			// Quality 5 compresses a cold 1.5 MB bundle in about 200 ms; quality 11 takes about 20 s for 10% fewer bytes.
			brotliCompress(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5, [constants.BROTLI_PARAM_SIZE_HINT]: body.length } }, done);
		} else {
			gzip(body, done);
		}
	});
}

export function encodedBodies() {
	const entries = new Map<string, Uint8Array>();
	return Effect.fn("WorkBoard.encodedBody")(function* (etag: string, body: Uint8Array, encoding: Encoding) {
		const key = `${encoding} ${etag}`;
		const known = entries.get(key);
		if (known) {
			entries.delete(key);
			entries.set(key, known);
			return known;
		}
		const encoded = yield* compress(body, encoding);
		entries.set(key, encoded);
		const oldest = entries.keys().next().value;
		if (entries.size > CACHED_ENCODINGS && oldest !== undefined) {
			entries.delete(oldest);
		}
		return encoded;
	});
}

export type EncodedBodies = ReturnType<typeof encodedBodies>;

export const encodeResponse = Effect.fn("WorkBoard.encodeResponse")(function* (
	request: HttpServerRequest.HttpServerRequest,
	response: HttpServerResponse.HttpServerResponse,
	cache?: EncodedBodies,
) {
	const { body } = response;
	if (
		response.status !== HttpStatus.fromLiteral("OK")
		|| body._tag !== "Uint8Array"
		|| !COMPRESSIBLE.test(body.contentType)
		|| response.headers["content-encoding"]
	) {
		return response;
	}
	const varied = HttpServerResponse.setHeader(response, "vary", "accept-encoding");
	const encoding = acceptedEncoding(request.headers["accept-encoding"]);
	if (!encoding || body.body.length < MIN_BYTES) {
		return varied;
	}
	const etag = response.headers.etag;
	return yield* (cache && etag ? cache(etag, body.body, encoding) : compress(body.body, encoding)).pipe(
		Effect.map((bytes) =>
			HttpServerResponse.setHeader(HttpServerResponse.setBody(varied, HttpBody.uint8Array(bytes, body.contentType)), "content-encoding", encoding),
		),
	);
});
