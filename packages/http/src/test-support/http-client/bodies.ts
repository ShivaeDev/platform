import { gzipSync } from "node:zlib";
import { Effect } from "effect";
import { httpClient } from "./story.ts";

function chunkSizes(chunks: readonly (string | Uint8Array)[]) {
	return chunks.map((chunk) => (typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk).byteLength).join(" + ");
}

export function remoteSends(...chunks: readonly (string | Uint8Array)[]) {
	return httpClient.trait("routes", `the remote sends /body in chunks of ${chunkSizes(chunks)} bytes`, ({ replies }) => {
		replies.body = { chunks };
	});
}

export function remoteSendsJson(body: unknown) {
	return httpClient.trait("routes", `the remote sends /body as the JSON ${JSON.stringify(body)}`, ({ replies }) => {
		replies.body = { body };
	});
}

function heldBody(line: string, chunks: readonly string[], headers: Readonly<Record<string, string>> = {}) {
	return httpClient.trait("routes", line, function* ({ replies }) {
		const gate = Promise.withResolvers<void>();
		yield* Effect.addFinalizer(() => Effect.sync(() => gate.resolve()));
		replies.body = {
			chunks: (async function* () {
				yield* chunks;
				await gate.promise;
			})(),
			headers,
		};
	});
}

export const remoteDeclaresOversizedBody = heldBody(
	"the remote declares Content-Length: 1000 for /body, sends 8 bytes and holds the rest",
	["abcdefgh"],
	{ "Content-Length": "1000" },
);

export const remoteStreamsSixteenBytes = heldBody("the remote streams 16 bytes of /body in chunks of 8 + 8 and holds the response open", [
	"abcdefgh",
	"ijklmnop",
]);

export function noContent(status: 204 | 205 | 304 = 204) {
	return httpClient.trait("routes", `the remote answers /body with HTTP ${status} and no content`, ({ replies }) => {
		replies.body = { headers: status === 304 ? { "content-length": "1000" } : {}, status };
	});
}

export const emptyBody = httpClient.trait("routes", "the remote sends a zero-length /body", ({ replies }) => {
	replies.body = { body: new Uint8Array(), headers: { "content-length": "0" } };
});

export function compressedBody(text: string) {
	return httpClient.trait("routes", `the remote sends /body as gzip of ${text.length} decoded bytes`, ({ replies }) => {
		const body = gzipSync(text);
		replies.body = { body, headers: { "content-encoding": "gzip", "content-length": String(body.byteLength) } };
	});
}

export const stalledBody = httpClient.trait("routes", "the remote stalls /body after its headers", function* ({ remote, lifecycle }) {
	lifecycle.stall = yield* remote.stall("body");
});
