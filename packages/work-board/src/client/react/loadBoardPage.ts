import { isRedirect, type LoaderFnContext, redirect } from "@tanstack/react-router";
import { Predicate } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import { documentQuery, navigationQuery } from "#client/page/routeQuery.ts";
import type { ShellOptions } from "./BoardShell.tsx";
import { documentRoute } from "./documentRoute.ts";
import { loadProjection } from "./loadProjection.ts";
import { loadRemaining } from "./loadRemaining.ts";
import { projectionRoute } from "./projectionRoute.ts";
import { remainingRoute } from "./remainingRoute.ts";

export type RouterShell = ShellOptions & { readonly registry: AtomRegistry.AtomRegistry };

export async function loadBoardPage({
	context: { shell },
	location,
	abortController,
}: Pick<LoaderFnContext, "location" | "abortController"> & { readonly context: { readonly shell?: RouterShell } }) {
	redirectRetired(location.pathname);
	if (!shell) {
		return undefined;
	}
	const { api, registry } = shell;
	const url = location.pathname + location.searchStr;
	try {
		const navigation = await loadQuery(registry, navigationQuery(api), { abortController });
		await redirectResponse(shell, url, location.pathname, abortController);
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
		await loadRemaining(registry, api, remainingRoute(location.pathname) ?? "start", url, abortController);
		return undefined;
	} catch (error) {
		if (mustRethrow(abortController, error)) {
			throw error;
		}
		// The mounted page owns failure wording and retained-data rendering.
		return { error };
	}
}

async function redirectResponse({ api, registry }: RouterShell, url: string, pathname: string, abortController: AbortController) {
	if (pathname !== "/_board/respond") {
		return;
	}
	const response = await loadRemaining(registry, api, "respond", url, abortController);
	if (response && "request" in response) {
		const item = response.document.identity ?? response.request.preview?.item ?? "";
		throw redirect({ href: `/_board/item/${encodeURIComponent(item)}/#answer-card-${encodeURIComponent(response.request.id)}`, replace: true });
	}
}

function mustRethrow(controller: AbortController, error: unknown) {
	return controller.signal.aborted || isRedirect(error);
}

function redirectRetired(pathname: string) {
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
