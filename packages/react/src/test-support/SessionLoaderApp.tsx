import { RegistryContext } from "@effect/atom-react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider, redirect } from "@tanstack/react-router";
import { Deferred, Predicate } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useState } from "react";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { loadQuery } from "#loadQuery.ts";
import type { LoaderSession } from "./loaderSession.ts";

function signIn(session: LoaderSession) {
	if (session.session !== undefined) {
		throw redirect({ to: "/private" });
	}
}
function RouteApp({ session }: { readonly session: LoaderSession }) {
	const registry = useContext(RegistryContext);
	const [router] = useState(() => {
		const atom = Atom.make(Deferred.await(session.gate));
		const root = createRootRoute({ component: Outlet });
		const home = createRoute({ component: () => <p>Home</p>, getParentRoute: () => root, path: "/" });
		const privateRoute = createRoute({
			component: () => <p>Private data</p>,
			errorComponent: ({ error }) => (
				<div>
					<p role="alert">{Predicate.isTagged(error, "Unauthorized") ? "Session expired" : "Load unavailable"}</p>
					<button onClick={() => void router.navigate({ to: "/sign-in" })} type="button">
						Sign in
					</button>
				</div>
			),
			getParentRoute: () => root,
			loader: (context) => loadQuery(registry, atom, context),
			path: "/private",
		});
		const login = createRoute({
			beforeLoad: () => signIn(session),
			component: () => <p>Signed out: sign in</p>,
			getParentRoute: () => root,
			path: "/sign-in",
		});
		const created = createRouter({
			defaultPendingMs: Number.POSITIVE_INFINITY,
			history: createMemoryHistory({ initialEntries: ["/"] }),
			routeTree: root.addChildren([home, privateRoute, login]),
		});
		session.busy = () => created.state.isLoading;
		return created;
	});
	return (
		<>
			<button onClick={() => void router.navigate({ to: "/private" })} type="button">
				Load private data
			</button>
			<RouterProvider router={router} />
		</>
	);
}
function DirectApp({ session }: { readonly session: LoaderSession }) {
	const registry = useContext(RegistryContext);
	const [atom] = useState(() => Atom.make(Deferred.await(session.gate)));
	const [message, show] = useState("Home");
	async function load() {
		session.busy = () => true;
		try {
			show(await loadQuery(registry, atom, { abortController: new AbortController() }));
		} catch (error) {
			show(Predicate.isTagged(error, "Unauthorized") ? "Session expired" : "Load unavailable");
		} finally {
			session.busy = () => false;
		}
	}
	return (
		<>
			<button onClick={() => void load()} type="button">
				Load private data
			</button>
			<p role="alert">{message}</p>
		</>
	);
}
export function SessionLoaderApp({ session, mode }: { readonly session: LoaderSession; readonly mode: "route" | "direct" }) {
	const [active, setActive] = useState(session.session);
	return (
		<SessionBoundary
			connect={() => undefined}
			identify={(id) => id}
			recheck={() => {
				session.rechecks += 1;
				session.recheckedSessions.push(session.session ?? "signed out");
				session.session = undefined;
			}}
			session={active}
			signedOut={<p>Session ended</p>}
		>
			{() => (
				<>
					<button onClick={() => setActive(session.session)} type="button">
						Apply session
					</button>
					{mode === "route" ? <RouteApp session={session} /> : <DirectApp session={session} />}
				</>
			)}
		</SessionBoundary>
	);
}
