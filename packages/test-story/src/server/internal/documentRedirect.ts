import type { Request } from "happy-dom";
import type BrowserWindow from "happy-dom/lib/window/BrowserWindow.js";

export function documentRedirect(request: Request, window: BrowserWindow, target: URL, status: number, body: Buffer<ArrayBuffer> | null) {
	const headers = new window.Headers(request.headers);
	if (target.origin !== new URL(request.url).origin) {
		for (const name of ["authorization", "cookie", "proxy-authorization"]) {
			headers.delete(name);
		}
	}
	const get = (status === 303 && request.method !== "HEAD") || ([301, 302].includes(status) && request.method === "POST");
	if (get) {
		headers.delete("content-type");
		headers.delete("content-length");
	}
	const nextBody = get ? null : body;
	return {
		body: nextBody,
		request: new window.Request(target.href, {
			body: nextBody,
			credentials: request.credentials,
			headers,
			method: get ? "GET" : request.method,
			redirect: request.redirect,
			signal: request.signal,
		}),
	};
}
