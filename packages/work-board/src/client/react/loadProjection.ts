import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { pageQueries } from "./pageQueries.ts";
import type { ProjectionRoute } from "./projectionRoute.ts";
import type { ShellApi } from "./ShellApi.ts";
export function loadProjection(
	registry: AtomRegistry.AtomRegistry,
	api: ShellApi,
	route: ProjectionRoute,
	url: string,
	abortController: AbortController,
) {
	switch (route) {
		case "today":
			return Promise.all(pageQueries(api, route, url, null).map((query) => loadQuery(registry, query, { abortController })));
		case "board":
			return loadQuery(registry, api.board.query({ url }, routeQueryOptions), { abortController });
		case "work":
			return loadQuery(registry, api.work.query({ url }, routeQueryOptions), { abortController });
		case "overview":
			return loadQuery(registry, api.overview.query(undefined, routeQueryOptions), { abortController });
		case "inbox":
			return loadQuery(registry, api.inbox.query(undefined, routeQueryOptions), { abortController });
	}
}
