import { Effect, Exit, Scope } from "effect";
import { afterAll, beforeAll } from "vitest";
import { domFetch } from "#domFetch.ts";
import { domNavigate } from "#domNavigate.ts";
import { storyKit } from "#storyKit.ts";
import { domHost } from "#test/domHost.ts";

const outbound: Record<string, string> = {};
let scope: Scope.Closeable;
let baseUrl: string;
beforeAll(async () => {
	scope = await Effect.runPromise(Scope.make());
	baseUrl = await Effect.runPromise(
		domHost(async (request, response) => {
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
		}).pipe(Effect.provideService(Scope.Scope, scope)),
	);
	outbound["provider.test"] = baseUrl;
});
afterAll(async () => Effect.runPromise(Scope.close(scope, Exit.void)));

export const documentApp = storyKit({
	clock: "live",
	create: () => ({ fetch: domFetch(baseUrl) }),
	name: "document",
	outbound,
	stages: ["page"],
	verbs: ({ fetch }) => ({
		cookies: () => document.cookie,
		heading: () => document.querySelector("h1")?.textContent,
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
