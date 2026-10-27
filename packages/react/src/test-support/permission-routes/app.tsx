import { createMemoryHistory, createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { Option } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { authAction } from "#client/authAction.ts";
import { useCan } from "#client/permissionBoundary.ts";
import { useQuery } from "#client/resultState.ts";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";
import { permissionGuard } from "#permissionGuard.ts";
import type { PermissionSession } from "#permissions.ts";
import { queryRoute } from "#queryRoute.ts";
import { ReadNotes } from "./feature.ts";
import type { Host } from "./host.ts";
import { Login, SignOutButton } from "./view.tsx";

function Controls() {
	const can = useCan();
	return (
		<main>
			<h1>Controls</h1>
			{can(ReadNotes) && <button type="button">Read notes</button>}
			{can(ReadNotes.any) && <button type="button">Read anyone's notes</button>}
		</main>
	);
}

export function permissionApp(host: Host, registry: AtomRegistry.AtomRegistry, session: PermissionSession | undefined, initial: string) {
	const auth = { current: session };
	const root = createRootRouteWithContext<{ registry: AtomRegistry.AtomRegistry; host: Host; auth: typeof auth }>()({
		beforeLoad: permissionGuard({ session: () => auth.current, signIn: "/login" }),
	});
	const signOut = authAction(async () => {
		auth.current = undefined;
		await router.invalidate();
		return { data: undefined, error: null };
	});
	const note = createRoute({
		component: () => {
			const { id } = note.useParams();
			const query = useLoaderQuery(host.api.get.query({ id }), note.useLoaderData());
			return (
				<>
					<h1>{query.data}</h1>
					<SignOutButton action={signOut} />
				</>
			);
		},
		getParentRoute: () => root,
		path: "/notes/$id",
		staticData: { permission: ReadNotes },
		...queryRoute(({ params }: { params: { id: string }; search: Record<string, never> }) => host.api.get.query(params)),
	});
	const direct = createRoute({
		component: () => {
			const query = useQuery(host.api.get.query({ id: "direct" }));
			return <h1>{Option.getOrElse(query.data, () => "Loading query")}</h1>;
		},
		getParentRoute: () => root,
		path: "/query",
	});
	const controls = createRoute({ component: Controls, getParentRoute: () => root, path: "/controls" });
	const login = createRoute({
		component: Login,
		getParentRoute: () => root,
		path: "/login",
		validateSearch: (search: Record<string, unknown>) => (typeof search.returnTo === "string" ? { returnTo: search.returnTo } : {}),
	});
	const router = createRouter({
		context: { auth, host, registry },
		defaultPendingMs: Number.POSITIVE_INFINITY,
		disableGlobalCatchBoundary: true,
		history: createMemoryHistory({ initialEntries: [initial] }),
		routeTree: root.addChildren([note, direct, controls, login]),
	});
	return { auth, host, router };
}
