import { isRedirect, type LoaderFnContext, redirect } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/react/loadQuery.ts";
import type { ShellOptions } from "#client/react/BoardShell.tsx";
import { documentRoute } from "#client/react/documentRoute.ts";
import { loadProjection } from "#client/react/loadProjection.ts";
import { loadRemaining } from "#client/react/loadRemaining.ts";
import { projectionRoute } from "#client/react/projectionRoute.ts";
import { remainingRoute } from "#client/react/remainingRoute.ts";
import { routeHome } from "#client/react/routeHome.ts";
import { documentQuery } from "#client/react/routeQuery.ts";
import { resultUrl } from "#responses/url.ts";

export type RouterShell = ShellOptions & { readonly registry: AtomRegistry.AtomRegistry };

export type BoardLoaderContext = Pick<LoaderFnContext, "location" | "abortController" | "preload"> & {
	readonly context: { readonly shell?: RouterShell };
};

// Settles on failure too, because the opening view lasts until this load settles; a navigation away aborts it through the router's abort controller.
export function openBoardPage(context: BoardLoaderContext): Promise<void> {
	redirectLegacy(context.location.pathname, context.location.searchStr);
	return loadBoardPage(context).then(
		() => undefined,
		() => undefined,
	);
}

export async function loadBoardPage({ context: { shell }, location, abortController }: BoardLoaderContext) {
	redirectLegacy(location.pathname, location.searchStr);
	if (!shell) {
		return undefined;
	}
	const { api, registry } = shell;
	const url = location.pathname + location.searchStr;
	try {
		const home = await routeHome(shell, location.pathname, abortController);
		const projection = projectionRoute(location.pathname, home);
		if (projection) {
			await loadProjection(registry, api, projection, url, abortController);
			return undefined;
		}
		if (documentRoute(location.pathname, home)) {
			await loadQuery(registry, documentQuery(api, url), { abortController });
			return undefined;
		}
		const remaining = remainingRoute(location.pathname);
		if (remaining) {
			await loadRemaining(registry, api, remaining, url, abortController);
		}
		return undefined;
	} catch (error) {
		if (mustRethrow(abortController, error)) {
			throw error;
		}
		// The mounted page owns failure wording and retained-data rendering.
		return { error };
	}
}

function mustRethrow(controller: AbortController, error: unknown) {
	return controller.signal.aborted || isRedirect(error);
}

function redirectLegacy(pathname: string, search: string) {
	if (pathname === "/_board/respond") {
		throw redirect({ href: pathname + search, reloadDocument: true });
	}
	if (pathname === "/_board/result") {
		throw redirect({ href: resultUrl(new URLSearchParams(search).get("item")), replace: true });
	}
	const retired: Readonly<Record<string, string>> = {
		"/_board/changes": "/_board/library?view=recently-changed",
		"/_board/diagnostics": "/_board/system",
		"/_board/inbox": "/",
		"/_board/overview": "/",
	};
	const target = retired[pathname];
	if (target) {
		throw redirect({ href: target, replace: true });
	}
}
