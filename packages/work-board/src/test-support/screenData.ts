import { act } from "react";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import { documentQuery, navigationQuery, routeQueryOptions } from "#client/react/routeQuery.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function screenData(engine: ScreenEngine, tell: (line: string) => void) {
	function client() {
		if (!(engine.api && engine.view)) {
			throw new Error("The Board screen has not opened");
		}
		return { api: engine.api, registry: engine.view.registry };
	}
	return {
		back: async () => {
			tell("the reader goes back");
			if (!engine.router) {
				throw new Error("The screen has no router");
			}
			await act(() => Promise.resolve().then(() => engine.router?.history.back()));
		},
		editFile: (file: string, source: string) => {
			tell(`an editor writes ${file}`);
			Object.assign(engine.files, { [file]: source });
		},
		failDocument: () => {
			tell("document reads become unavailable");
			engine.documentFailed = true;
		},
		finishNavigation: async () => {
			tell("the destination finishes opening");
			await act(async () => {
				await engine.pendingNavigation;
			});
		},
		preload: async (to: string) => {
			tell("the reader preloads a destination");
			if (!engine.router) {
				throw new Error("The screen has no router");
			}
			const [path = to, query] = to.split("?");
			await act(() =>
				Promise.resolve().then(() => engine.router?.preloadRoute({ search: Object.fromEntries(new URLSearchParams(query)), to: path })),
			);
		},
		readGoals: () => {
			tell("the reader reads the Board's goals projection");
			const { api, registry } = client();
			return loadQuery(registry, api.goals.query(undefined, routeQueryOptions), { abortController: new AbortController() });
		},
		readInbox: () => {
			tell("the reader reads the Board's inbox projection");
			const { api, registry } = client();
			return loadQuery(registry, api.inbox.query(undefined, routeQueryOptions), { abortController: new AbortController() });
		},
		readNavigation: () => {
			tell("the reader reads the Board navigation projection");
			const { api, registry } = client();
			return loadQuery(registry, navigationQuery(api), { abortController: new AbortController() });
		},
		readResponses: async (item: string, request: string) => {
			tell(`the reader reads saved responses to ${item}/${request}`);
			const { api, registry } = client();
			const options = { abortController: new AbortController() };
			const preview = await loadQuery(registry, api.forms.responses.question.query({ item, request }), options);
			const query = api.forms.responses.responses.query({ question: preview.id });
			registry.refresh(query);
			return loadQuery(registry, query, options);
		},
		recoverDocument: () => {
			tell("document reads recover");
			engine.documentFailed = false;
		},
		refreshDocument: async (url = engine.router?.state.location.href ?? engine.path) => {
			tell(`the reader refreshes ${url}`);
			const { api, registry } = client();
			await act(() =>
				Promise.resolve().then(() => {
					registry.refresh(documentQuery(api, url));
					registry.refresh(navigationQuery(api));
				}),
			);
		},
		refreshQuery: async (kind: "document" | "handoff" | "work" | "search", input: { readonly url: string } | { readonly query: string }) => {
			tell(`the reader refreshes the ${kind} query`);
			const { api, registry } = client();
			if (kind === "search") {
				if (!("query" in input)) {
					throw new Error("Search requires a query");
				}
				await act(() => Promise.resolve().then(() => registry.refresh(api.search.query(input))));
				return;
			}
			if (!("url" in input)) {
				throw new Error("The query requires a URL");
			}
			const refresh = {
				document: () => registry.refresh(api.document.query(input, routeQueryOptions)),
				handoff: () => registry.refresh(api.handoff.query(input, routeQueryOptions)),
				work: () => registry.refresh(api.work.query(input, routeQueryOptions)),
			};
			await act(() => Promise.resolve().then(refresh[kind]));
		},
		refreshSearch: async (query: string) => {
			tell(`the reader refreshes search for ${query}`);
			const { api, registry } = client();
			await act(() => Promise.resolve().then(() => registry.refresh(api.search.query({ query }))));
		},
		startNavigation: async (to: string) => {
			tell(`the reader begins navigating to ${to}`);
			if (!engine.router) {
				throw new Error("The screen has no router");
			}
			await act(async () => {
				engine.pendingNavigation = engine.router?.navigate({ to });
				await Promise.resolve();
			});
		},
	};
}
