import { get } from "node:http";
import { Effect } from "effect";

function connectionError(error: Error) {
	return { code: "code" in error ? error.code : undefined, kind: "error", message: error.message } as const;
}

type ConnectionError = ReturnType<typeof connectionError>;

export function httpProbe(url: string) {
	const headers = Promise.withResolvers<
		{ readonly kind: "headers"; readonly status: number | undefined; readonly headers: Record<string, unknown> } | ConnectionError
	>();
	const finished = Promise.withResolvers<{ readonly kind: "complete"; readonly bytes: Buffer } | ConnectionError>();
	const chunks: Buffer[] = [];
	const unread: Buffer[] = [];
	let pendingChunk: ((chunk: Buffer | undefined) => void) | undefined;
	let ended = false;
	function finish() {
		ended = true;
		pendingChunk?.(undefined);
	}
	const request = get(url, (response) => {
		headers.resolve({ headers: response.headers, kind: "headers", status: response.statusCode });
		response.on("data", (chunk: Buffer) => {
			chunks.push(chunk);
			if (pendingChunk) {
				pendingChunk(chunk);
				pendingChunk = undefined;
			} else {
				unread.push(chunk);
			}
		});
		response.once("end", () => {
			finished.resolve({ bytes: Buffer.concat(chunks), kind: "complete" });
			finish();
		});
		response.once("error", (error) => {
			finished.resolve(connectionError(error));
			finish();
		});
	});
	request.once("error", (error) => {
		headers.resolve(connectionError(error));
		finished.resolve(connectionError(error));
		finish();
	});
	return {
		abort: Effect.sync(() => request.destroy()),
		finished: Effect.promise(() => finished.promise),
		headers: Effect.promise(() => headers.promise),
		nextChunk: Effect.promise(() => {
			const chunk = unread.shift();
			if (chunk || ended) {
				return Promise.resolve(chunk);
			}
			return new Promise<Buffer | undefined>((resolve) => {
				pendingChunk = resolve;
			});
		}),
	};
}
