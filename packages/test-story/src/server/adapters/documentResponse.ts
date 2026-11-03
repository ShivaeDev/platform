import { Readable } from "node:stream";
import type { Headers, IBrowserFrame, Request } from "happy-dom";
import FetchResponseHeaderUtility from "happy-dom/lib/fetch/utilities/FetchResponseHeaderUtility.js";

export function documentResponseHeaders(response: Response, request: Request, frame: IBrowserFrame) {
	return FetchResponseHeaderUtility.parseResponseHeaders({
		browserFrame: frame,
		rawHeaders: [...response.headers]
			.flatMap(([name, value]) => (name === "set-cookie" ? [] : [name, value]))
			.concat(response.headers.getSetCookie().flatMap((cookie) => ["set-cookie", cookie])),
		"requestURL": new URL(request.url),
	});
}

export function documentResponse(
	response: Response,
	request: Request,
	frame: IBrowserFrame,
	release: () => void,
	redirected: boolean,
	headers: Headers,
) {
	if (response.body === null) {
		release();
	}
	const result = new frame.window.Response(response.body === null ? null : Readable.toWeb(Readable.from(chunks(response.body, release))), {
		headers,
		status: response.status,
		statusText: response.statusText,
	});
	Object.defineProperty(result, "url", { value: request.url });
	Object.defineProperty(result, "redirected", { value: redirected });
	return result;
}

async function* chunks(stream: ReadableStream<Uint8Array>, release: () => void) {
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				return;
			}
			yield value;
		}
	} finally {
		release();
		await reader.cancel();
		reader.releaseLock();
	}
}
