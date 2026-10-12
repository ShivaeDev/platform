import { createRootRouteWithContext, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import type { NotesClient } from "./makeNotes.ts";
import { NotesScreen } from "./NotesScreen.tsx";

export function appRouter(registry: AtomRegistry.AtomRegistry, client: NotesClient, history?: RouterHistory) {
	const root = createRootRouteWithContext<{ readonly registry: AtomRegistry.AtomRegistry }>()();
	const notes = createRoute({
		component: () => <NotesScreen client={client} />,
		errorComponent: ({ reset: handleClick }) => (
			<main className="p-8">
				<p role="alert">Could not load notes.</p>
				<button onClick={handleClick} type="button">
					Retry
				</button>
			</main>
		),
		getParentRoute: () => root,
		loader: (context) => loadQuery(context.context.registry, client.api.list.query(), context),
		path: "/",
	});
	return createRouter({ context: { registry }, ...(history === undefined ? {} : { history }), routeTree: root.addChildren([notes]) });
}
