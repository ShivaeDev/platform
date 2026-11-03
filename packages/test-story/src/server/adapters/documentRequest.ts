import type { Request } from "happy-dom";

export async function documentRequest(
	fetch: typeof globalThis.fetch,
	request: Request,
	body: Buffer<ArrayBuffer> | null,
	headers: Readonly<Record<string, string>>,
) {
	const controller = new AbortController();
	function abort() {
		controller.abort(request.signal.reason);
	}
	function release() {
		request.signal.removeEventListener("abort", abort);
	}
	if (request.signal.aborted) {
		abort();
	}
	request.signal.addEventListener("abort", abort, { once: true });
	try {
		return { release, response: await fetch(request.url, { body, headers, method: request.method, redirect: "manual", signal: controller.signal }) };
	} catch (error) {
		release();
		throw error;
	}
}
