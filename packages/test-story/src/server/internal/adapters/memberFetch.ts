import type { Response as BrowserResponse, BrowserWindow } from "happy-dom";

function responseBody(response: BrowserResponse, release: () => void) {
	if (response.body === null) {
		release();
		return null;
	}
	const reader = response.body.getReader();
	return new ReadableStream<Uint8Array>({
		async cancel(reason) {
			release();
			await reader.cancel(reason);
		},
		async pull(controller) {
			try {
				const next = await reader.read();
				if (next.done) {
					release();
					controller.close();
				} else {
					controller.enqueue(next.value);
				}
			} catch (error) {
				release();
				controller.error(error);
			}
		},
	});
}

export function memberFetch(browser: BrowserWindow): typeof globalThis.fetch {
	return async (input, init) => {
		const request = new Request(input, init);
		const controller = new browser.AbortController();
		function abort() {
			controller.abort(request.signal.reason);
		}
		function release() {
			request.signal.removeEventListener("abort", abort);
		}
		request.signal.addEventListener("abort", abort, { once: true });
		if (request.signal.aborted) {
			abort();
		}
		try {
			const response = await browser.fetch(request.url, {
				body: request.body === null ? null : await request.arrayBuffer(),
				credentials: request.credentials,
				headers: [...request.headers],
				method: request.method,
				redirect: request.redirect,
				signal: controller.signal,
			});
			const result = new Response(responseBody(response, release), {
				headers: [...response.headers],
				status: response.status,
				statusText: response.statusText,
			});
			Object.defineProperty(result, "url", { value: response.url });
			Object.defineProperty(result, "redirected", { value: response.redirected });
			return result;
		} catch (error) {
			release();
			throw error;
		}
	};
}
