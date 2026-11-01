import { CatchBoundary, getRouteApi, Link, RouterProvider, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactNode } from "react";
import { Forbidden } from "#adapters/Forbidden.ts";
import { PermissionBoundary } from "#adapters/permissionBoundary.ts";
import { useSignOut } from "#client/adapters/useSignOut.ts";
import type { permissionApp } from "./app.tsx";

type App = ReturnType<typeof permissionApp>;
type Router = App["router"];
const login = getRouteApi<"/login", Router>("/login");

export function Login(): ReactNode {
	const { returnTo } = login.useSearch<Router>();
	const { host, auth, registry } = login.useRouteContext<Router>();
	const router = useRouter<Router>();
	return (
		<main>
			<h1>Sign in</h1>
			<button
				onClick={async () => {
					host.state.role = "reader";
					auth.current = await Effect.runPromise(AtomRegistry.getResult(registry, host.readSession("reader").atom));
					await router.navigate({ href: returnTo ?? "/controls" });
				}}
				type="button"
			>
				Sign in
			</button>
		</main>
	);
}

export function PermissionApp({ app }: { readonly app: App }): ReactNode {
	return (
		<CatchBoundary errorComponent={ApplicationFailure} getResetKey={() => "app"}>
			<RouterProvider router={app.router} />
		</CatchBoundary>
	);
}

function ApplicationFailure() {
	return <h1 data-boundary="application">Application unavailable</h1>;
}

export function SignOutButton({ action }: { readonly action: Atom.AtomResultFn<void, undefined, unknown> }) {
	const signOut = useSignOut(action, { signIn: "/login" });
	return (
		<button onClick={signOut.dispatch} type="button">
			Sign out
		</button>
	);
}

export function PermissionRoutes({ children }: { readonly children: ReactNode }) {
	const router = useRouter<Router>();
	return (
		<PermissionBoundary fallback={<DeniedRoute />} session={router.options.context?.auth.current}>
			{children}
		</PermissionBoundary>
	);
}

function DeniedRoute() {
	const { host } = getRouteApi<"__root__", Router>("__root__").useRouteContext<Router>();
	return (
		<div data-boundary="permission" data-role={host.state.role}>
			<Forbidden to="/controls" />
			<Link to="/login">Use another account</Link>
		</div>
	);
}
