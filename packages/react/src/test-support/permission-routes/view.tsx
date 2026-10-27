import { getRouteApi, RouterProvider, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { createContext, type ReactNode, useContext, useState } from "react";
import { PermissionBoundary } from "#client/permissionBoundary.ts";
import type { PermissionSession } from "#permissions.ts";
import type { permissionApp } from "./app.tsx";

type App = ReturnType<typeof permissionApp>;
type Router = App["router"];
const login = getRouteApi<"/login", Router>("/login");
const ApplySessionContext = createContext<(session: PermissionSession) => void>(() => undefined);

export function Login(): ReactNode {
	const { returnTo } = login.useSearch<Router>();
	const { host, auth } = login.useRouteContext<Router>();
	const apply = useContext(ApplySessionContext);
	const router = useRouter<Router>();
	return (
		<main>
			<h1>Sign in</h1>
			<button
				onClick={async () => {
					host.state.role = "reader";
					auth.current = await Effect.runPromise(host.payload("reader"));
					apply(auth.current);
					await router.navigate({ href: returnTo });
				}}
				type="button"
			>
				Sign in
			</button>
		</main>
	);
}

export function PermissionApp({ app }: { readonly app: App }): ReactNode {
	const [current, apply] = useState(app.auth.current);
	return (
		<ApplySessionContext.Provider value={apply}>
			<PermissionBoundary fallback={<h1>Permission denied</h1>} session={current}>
				<RouterProvider router={app.router} />
			</PermissionBoundary>
		</ApplySessionContext.Provider>
	);
}
