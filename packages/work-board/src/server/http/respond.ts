import { HttpServerResponse } from "effect/http";

const POLICY = [
	"default-src 'self'",
	"script-src 'self' 'wasm-unsafe-eval'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: https:",
	"object-src 'none'",
	"form-action 'none'",
	"frame-src 'none'",
	"base-uri 'none'",
	"frame-ancestors 'none'",
].join("; ");

export const HEADERS = { "cache-control": "no-store", "content-security-policy": POLICY, "x-content-type-options": "nosniff" };

export function respond(body: string | Uint8Array, contentType: string, status = 200): HttpServerResponse.HttpServerResponse {
	return typeof body === "string"
		? HttpServerResponse.text(body, { contentType: `${contentType}; charset=utf-8`, headers: HEADERS, status })
		: HttpServerResponse.uint8Array(body, { contentType, headers: HEADERS, status });
}
