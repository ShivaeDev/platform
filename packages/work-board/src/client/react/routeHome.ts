import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { loadQuery } from "@shivaedev/effect-react/loadQuery.ts";
import { documentRoute } from "./documentRoute.ts";
import type { RouterShell } from "./loadBoardPage.ts";
import { navigationQuery } from "./routeQuery.ts";

// Only a document address can name the home board, and the home board moves so rarely that the last navigation read decides the route.
export async function routeHome({ api, registry }: RouterShell, pathname: string, abortController: AbortController) {
	if (!documentRoute(pathname, undefined) || pathname === "/") {
		return undefined;
	}
	const query = navigationQuery(api);
	const known = AsyncResult.value(registry.get(query));
	return Option.isSome(known) ? known.value.home : (await loadQuery(registry, query, { abortController })).home;
}
