import { Effect, Exit, Scope } from "effect";
import { afterAll, beforeAll, expect } from "vitest";
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
	create: () => {
		expect(window.fetch).not.toBe(globalThis.fetch);
		return { fetch: domFetch(baseUrl) };
	},
	name: "document",
	outbound,
	stages: ["page"],
	verbs: ({ fetch }) => ({
		loadPage: () =>
			Effect.promise(async () => {
				const response = await domNavigate("https://provider.test/page");
				expect(document.querySelector("h1")?.textContent).toBe("Routed document");
				expect(window.location.href).toBe("https://provider.test/page");
				expect(await response.text()).toContain("Routed document");
			}),
		redirectedPostIs: (status: number, method: string, body: string) =>
			Effect.promise(async () => {
				const response = await fetch(
					new Request(`https://provider.test/redirect?status=${status}`, {
						body: "story-body",
						credentials: "include",
						headers: new Headers({ "x-story": "retained" }),
						method: "POST",
					}),
				);
				expect(response.redirected).toBe(true);
				expect(response.url).toBe("https://provider.test/echo");
				expect(response.headers.get("set-cookie")).toBeNull();
				expect(await response.json()).toEqual({ body, cookie: "first=one; second=two", header: "retained", method, path: "/echo" });
				expect(document.cookie).not.toContain("first=");
			}),
		syncRequestIsRefused: () => {
			const request = new window.XMLHttpRequest();
			let message: string | undefined;
			request.addEventListener("error", (event) => {
				if (event instanceof window.ErrorEvent) {
					message = event.message;
				}
			});
			request.open("GET", "https://provider.test/echo", false);
			request.send();
			expect(message).toContain("test-story refuses synchronous document requests to provider.test");
		},
		xhrIsRouted: () =>
			Effect.promise(async () => {
				const text = await new Promise<string>((resolve, reject) => {
					const request = new window.XMLHttpRequest();
					request.open("GET", "https://provider.test/echo");
					request.onload = () => resolve(request.responseText);
					request.onerror = () => reject(new Error("Document XMLHttpRequest failed"));
					request.send();
				});
				expect(JSON.parse(text)).toMatchObject({ method: "GET", path: "/echo" });
			}),
	}),
});
