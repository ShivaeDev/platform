import { Effect } from "effect";
import type { Window } from "happy-dom";
import { vi } from "vitest";
import { domNavigate } from "#domNavigate.ts";
import { routeOutbound } from "#routeOutbound.ts";
import { storyKit } from "#storyKit.ts";
import { domHost } from "#test/domHost.ts";

declare const window: Window;

export const assetDocument = storyKit({
	clock: "live",
	*create() {
		const errors = yield* Effect.acquireRelease(
			Effect.sync(() => vi.spyOn(window.console, "error")),
			(recording) => Effect.sync(() => recording.mockRestore()),
		);
		const requests: string[] = [];
		const url = yield* domHost((request, response) => {
			requests.push(`${request.method} ${request.url}`);
			response.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html>
<html><head>
<link rel="stylesheet" href="https://assets.test/site.css">
<script type="module" src="https://assets.test/site.js"></script>
</head><body><h1>Page with external assets</h1></body></html>`);
		});
		yield* routeOutbound({ "assets.test": url, "provider.test": url });
		return { errors, requests };
	},
	name: "asset document",
	stages: [],
	verbs: ({ errors, requests }, story) => ({
		heading: () => document.querySelector("h1")?.textContent,
		loadPage: () => {
			story.tell("navigate to the page with an external stylesheet and module script");
			return Effect.promise(() => domNavigate("https://provider.test/page"));
		},
		loggedErrors: () => errors.mock.calls.flat().map(String),
		receivedRequests: () => [...requests],
		settle: () => {
			story.tell("wait for document tasks to finish");
			return Effect.promise(() => window.happyDOM.waitUntilComplete());
		},
	}),
});
