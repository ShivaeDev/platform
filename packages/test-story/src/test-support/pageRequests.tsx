import { Effect, Exit, Option, Scope, Stream } from "effect";
import { act } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { domPage } from "#domPage.ts";
import { fakeHttpService } from "#fakeHttpService.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { background } from "./attempt.ts";
import { ErrorPage } from "./ErrorPage.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

export const pageRequests = storyKit({
	clock: "live",
	*create() {
		const originalFetch = globalThis.fetch;
		const originalUrl = window.location.href;
		const host = yield* fakeHttpService({
			routes: {
				echo: { method: "POST", path: "/notes/echo", reply: () => ({ body: "received" }) },
				first: { path: "/first", reply: () => ({ body: "first reply" }) },
				report: { method: "POST", path: "/_platform/errors", reply: () => ({ status: 202 }) },
				second: { path: "/second", reply: () => ({ body: "second reply" }) },
			},
		});
		const scope = yield* Effect.acquireRelease(Scope.make(), (current) => Scope.close(current, Exit.void));
		const page = yield* domPage(`${host.url}/notes/current`).pipe(Effect.provideService(Scope.Scope, scope));
		function expectedError(event: ErrorEvent) {
			if (event.message === "page action failed") {
				event.preventDefault();
			}
		}
		yield* Effect.acquireRelease(
			Effect.sync(() => window.addEventListener("error", expectedError)),
			() => Effect.sync(() => window.removeEventListener("error", expectedError)),
		);
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(<ErrorPage />)),
			(mounted) => Effect.promise(mounted.unmount),
		);
		return { host, originalFetch, originalUrl, page, scope, view };
	},
	inspect: ({ host }) => ({ requests: host.requests }),
	name: "page requests",
	stages: [],
	verbs: ({ host, originalFetch, originalUrl, page, scope, view }, story) => {
		const screen = screenDriver({ act, pending: page.pending, root: view.container, tell: story.tell });
		const settling = background();
		return {
			...screen,
			abort: (request: { readonly controller: AbortController }) =>
				Effect.sync(() => {
					story.tell("abort the page request");
					request.controller.abort();
				}),
			close: () => {
				story.tell("close the page");
				return Scope.close(scope, Exit.void);
			},
			drop: (route: string) => host.fault(route, { kind: "drop" }),
			hold: (route: string) => host.hold(route),
			navigate: () =>
				Effect.sync(() => {
					story.tell("navigate within the page");
					window.history.pushState(null, "", "/notes/nested/next");
				}),
			outsidePage: () =>
				Effect.promise(async () => {
					try {
						await fetch("/_platform/errors");
						return "sent";
					} catch {
						return "relative URL rejected";
					}
				}),
			reports: () =>
				Effect.sync(() =>
					host.requests
						.filter(({ path }) => path === "/_platform/errors")
						.map(({ body, method, path }) => ({ body: JSON.parse(body.toString()), method, path })),
				),
			requestState: () =>
				Stream.runHead(page.pending).pipe(Effect.map((busy) => (Option.getOrElse(busy, () => false) ? "requests pending" : "idle"))),
			requests: () =>
				Effect.sync(() =>
					host.requests.map(({ body, headers, method, path }) => ({ body: body.toString(), header: headers["x-page"], method, path })),
				),
			restored: () => Effect.sync(() => ({ fetch: globalThis.fetch === originalFetch, location: window.location.href === originalUrl })),
			send: (kind: "relative" | "URL" | "Request") =>
				Effect.promise(async () => {
					story.tell(`post through the page with ${kind}`);
					const init = { body: "page payload", headers: new Headers({ "x-page": "page header" }), method: "POST" };
					const absolute = `${host.url}/notes/echo?from=page`;
					if (kind === "Request") {
						await fetch(new Request(absolute, init));
					} else {
						await fetch(kind === "relative" ? "../echo?from=page" : new URL(absolute), init);
					}
				}),
			settled: () => settling.finished("screen"),
			settling: () => settling.progress("screen", "waiting"),
			start: (path: string) =>
				Effect.sync(() => {
					story.tell(`start a page request to ${path}`);
					const controller = new AbortController();
					const response = fetch(path, { signal: controller.signal }).catch(() => undefined);
					return { controller, finished: Effect.promise(() => response).pipe(Effect.asVoid) };
				}),
			startSettling: () => settling.starts("screen", screen.settle()),
		};
	},
});
