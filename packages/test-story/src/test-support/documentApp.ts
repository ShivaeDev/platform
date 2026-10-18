import { Effect } from "effect";
import { domFetch } from "#domFetch.ts";
import { domNavigate } from "#domNavigate.ts";
import { routeOutbound } from "#internal/routeOutbound.ts";
import { storyKit } from "#storyKit.ts";
import { domHost } from "#test/domHost.ts";

const host = domHost(async (request, response) => {
	const url = new URL(request.url ?? "/", "https://provider.test");
	if (url.pathname === "/redirect") {
		response
			.writeHead(Number(url.searchParams.get("status")), {
				location: "/echo",
				"set-cookie": ["first=one; Path=/; HttpOnly", "second=two; Path=/; HttpOnly"],
			})
			.end();
		return;
	}
	if (url.pathname === "/page") {
		response.setHeader("content-type", "text/html");
		response.end("<h1>Routed document</h1>");
		return;
	}
	const body: Buffer[] = [];
	for await (const chunk of request) {
		body.push(Buffer.from(chunk));
	}
	response.setHeader("content-type", "application/json");
	response.end(
		JSON.stringify({
			body: Buffer.concat(body).toString(),
			cookie: request.headers.cookie,
			header: request.headers["x-story"],
			method: request.method,
			path: request.url,
		}),
	);
});

export const documentApp = storyKit({
	clock: "live",
	*create() {
		if (window.fetch === globalThis.fetch) {
			throw new Error("Document stories need the test-story DOM environment with separate window.fetch and host fetch.");
		}
		const baseUrl = yield* host;
		yield* routeOutbound({ "provider.test": baseUrl });
		return { baseUrl, fetch: domFetch(baseUrl) };
	},
	name: "document",
	stages: ["page"],
	verbs: ({ baseUrl, fetch }) => ({
		cookies: () => document.cookie,
		heading: () => document.querySelector("h1")?.textContent,
		hostUrl: () => baseUrl,
		loadPage: () => Effect.promise(() => domNavigate("https://provider.test/page")),
		location: () => window.location.href,
		post: (status: number, body: string) =>
			Effect.promise(() =>
				fetch(
					new Request(`https://provider.test/redirect?status=${status}`, {
						body,
						credentials: "include",
						headers: new Headers({ "x-story": "retained" }),
						method: "POST",
					}),
				),
			),
		syncRequest: () => {
			const request = new window.XMLHttpRequest();
			let message: string | undefined;
			request.addEventListener("error", (event) => {
				if (event instanceof window.ErrorEvent) {
					message = event.message;
				}
			});
			request.open("GET", "https://provider.test/echo", false);
			request.send();
			return message;
		},
		xhr: () =>
			Effect.promise(
				() =>
					new Promise<string>((resolve, reject) => {
						const request = new window.XMLHttpRequest();
						request.open("GET", "https://provider.test/echo");
						request.onload = () => resolve(request.responseText);
						request.onerror = () => reject(new Error("Document XMLHttpRequest failed"));
						request.send();
					}),
			),
	}),
});
