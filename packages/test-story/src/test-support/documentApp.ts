import { Effect, Schema } from "effect";
import { domFetch } from "#domFetch.ts";
import { domNavigate } from "#domNavigate.ts";
import { routeOutbound } from "#routeOutbound.ts";
import { seedCookies } from "#seedCookies.ts";
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

const Echo = Schema.Struct({ cookie: Schema.optional(Schema.String), method: Schema.String, path: Schema.String });

function xhrEcho() {
	return new Promise<string>((resolve, reject) => {
		const request = new window.XMLHttpRequest();
		request.open("GET", "https://provider.test/echo");
		request.onload = () => {
			const echoed = Schema.decodeUnknownSync(Echo)(JSON.parse(request.responseText));
			resolve(`${echoed.method} ${echoed.path}`);
		};
		request.onerror = () => reject(new Error("Document XMLHttpRequest failed"));
		request.send();
	});
}

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
	verbs: ({ fetch }, story) => {
		const redirected: { echo: unknown; setCookie: string | null; url: string } = { echo: undefined, setCookie: null, url: "" };
		const page = { body: "" };
		return {
			documentCookies: () => Effect.sync(() => document.cookie),
			echo: () => Effect.sync(() => redirected.echo),
			exposedSetCookie: () => Effect.sync(() => redirected.setCookie ?? "none"),
			finalUrl: () => Effect.sync(() => redirected.url),
			heading: () => Effect.sync(() => document.querySelector("h1")?.textContent ?? "no heading"),
			hostSawCookies: () => Effect.promise(async () => Schema.decodeUnknownSync(Echo)(await (await fetch("/echo")).json()).cookie ?? "no cookies"),
			loadsPage: () =>
				Effect.promise(async () => {
					page.body = await (await domNavigate("https://provider.test/page")).text();
				}),
			location: () => Effect.sync(() => window.location.href),
			pageBody: () => Effect.sync(() => page.body),
			postsThroughRedirect: (status: number, body: string) =>
				Effect.promise(async () => {
					const response = await fetch(
						new Request(`https://provider.test/redirect?status=${status}`, {
							body,
							credentials: "include",
							headers: new Headers({ "x-story": "retained" }),
							method: "POST",
						}),
					);
					redirected.url = response.url;
					redirected.setCookie = response.headers.get("set-cookie");
					redirected.echo = await response.json();
				}),
			redirectCookiesOnPage: () =>
				Effect.sync(() => {
					const names = document.cookie
						.split("; ")
						.map((cookie) => cookie.split("=")[0])
						.filter((name) => name === "first" || name === "second");
					return names.length === 0 ? "none" : names.join(", ");
				}),
			requestsSynchronously: () =>
				Effect.sync(() => {
					const request = new window.XMLHttpRequest();
					let message = "no error";
					request.addEventListener("error", (event) => {
						if (event instanceof window.ErrorEvent) {
							message = event.message;
						}
					});
					request.open("GET", "https://provider.test/echo", false);
					request.send();
					return message;
				}),
			seedsSession: () => {
				story.tell("seed a secure HttpOnly session precondition");
				return seedCookies([
					{ httpOnly: true, name: "session", path: "/", secure: true, value: "minted-session" },
					{ name: "theme", path: "/", secure: true, value: "dark" },
				]);
			},
			storesPreference: () => Effect.promise(() => window.cookieStore.set("preference", "compact")),
			xhrRequest: () => Effect.promise(xhrEcho),
		};
	},
});
