import type { LoaderFnContext } from "@tanstack/react-router";
import { Predicate } from "effect";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import { documentQuery, pageQuery } from "#client/page/routeQuery.ts";
import type { ShellOptions } from "./BoardShell.tsx";
import { documentRoute } from "./documentRoute.ts";
import { loadProjection } from "./loadProjection.ts";
import { projectionRoute } from "./projectionRoute.ts";

export type RouterShell = ShellOptions & { readonly registry: AtomRegistry.AtomRegistry };

export async function loadBoardPage({
	context: { shell },
	location,
	abortController,
}: Pick<LoaderFnContext, "location" | "abortController"> & { readonly context: { readonly shell?: RouterShell } }) {
	if (!shell) {
		return undefined;
	}
	const { api, registry } = shell;
	const url = location.pathname + location.searchStr;
	try {
		const navigation = await loadQuery(registry, api.navigation.query({ current: "" }), { abortController });
		const projection = projectionRoute(location.pathname, navigation.home);
		if (projection) {
			await loadProjection(registry, api, projection, url, abortController);
			return undefined;
		}
		if (documentRoute(location.pathname, navigation.home)) {
			try {
				const data = await loadQuery(registry, documentQuery(api, url), { abortController });
				if (data.reading?.board) {
					await loadProjection(registry, api, "board", url, abortController);
				}
				return undefined;
			} catch (error) {
				if (!(location.pathname === "/" && Predicate.isTagged(error, "NotFound"))) {
					throw error;
				}
			}
		}
		await loadQuery(registry, pageQuery(api, url), { abortController });
		return undefined;
	} catch (error) {
		if (abortController.signal.aborted) {
			throw error;
		}
		// The mounted page owns failure wording and retained-data rendering.
		return { error };
	}
}
