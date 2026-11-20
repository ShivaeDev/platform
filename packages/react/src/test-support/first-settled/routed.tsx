import { RegistryContext } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider as TanStackRouterProvider,
} from "@tanstack/react-router";
import { Option } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useState } from "react";
import { queryRoute } from "#client/adapters/queryRoute.ts";
import { useFirstSettled } from "#client/adapters/useFirstSettled.ts";
import { useQuery } from "#client/resultState.ts";
import { RouterProvider } from "#RouterProvider.ts";
import type { FirstSettledClient } from "#test/first-settled/client.ts";

export type FirstRoute = "a loader that reads the title" | "a component that reads the title" | "nothing";
export type Provider = "react's" | "TanStack's";

const paths: Record<FirstRoute, string> = {
	"a component that reads the title": "/read",
	"a loader that reads the title": "/loaded",
	nothing: "/blank",
};

interface RouteContext {
	readonly notes: FirstSettledClient;
	readonly registry: AtomRegistry.AtomRegistry;
}

const root = createRootRouteWithContext<RouteContext>()({ component: Outlet });
const loadedTitle = queryRoute(({ context }: { context: RouteContext; params: object; search: object }) => context.notes.client.api.title.query());

function LoadedTitle() {
	return <output data-answer="title">{loadedTitle.useQuery().data}</output>;
}
function ReadTitle() {
	const context: RouteContext = root.useRouteContext();
	const title = useQuery(context.notes.client.api.title.query());
	const shown = Option.getOrElse(title.data, () => "waiting");
	return <output data-answer="title">{shown}</output>;
}
function Blank() {
	return <output data-answer="blank">blank form</output>;
}

const routeTree = root.addChildren([
	createRoute({ ...loadedTitle, component: LoadedTitle, getParentRoute: () => root, path: paths["a loader that reads the title"] }),
	createRoute({ component: ReadTitle, getParentRoute: () => root, path: paths["a component that reads the title"] }),
	createRoute({ component: Blank, getParentRoute: () => root, path: paths.nothing }),
]);

export function RoutedNotes({
	notes,
	provider,
	route,
}: {
	readonly notes: FirstSettledClient;
	readonly provider: Provider;
	readonly route: FirstRoute;
}) {
	const settled = useFirstSettled(notes.client);
	const registry = useContext(RegistryContext);
	const [router] = useState(() =>
		createRouter({
			context: { notes, registry },
			defaultPendingMs: Number.POSITIVE_INFINITY,
			history: createMemoryHistory({ initialEntries: [paths[route]] }),
			routeTree,
		}),
	);
	const status = settled ? "first results settled" : "waiting for first results";
	const routes = provider === "react's" ? <RouterProvider router={router} /> : <TanStackRouterProvider router={router} />;
	return (
		<article>
			<p role="status">{status}</p>
			{routes}
		</article>
	);
}
