import { createRootRoute, createRoute, createRouter, Outlet, type RouterHistory, RouterProvider, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { permissionGuard } from "#adapters/permissionGuard.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";

export interface BoundarySession {
	readonly id: string;
	readonly user: { readonly id: string };
}
export interface BoundaryScreen {
	readonly browserHistory: boolean;
	readonly history: RouterHistory;
	pending: () => boolean;
	readonly sessionIdentity: boolean;
	readonly signedIn: boolean;
}

function ProtectedScreen({ handlePasswordChange }: { readonly handlePasswordChange: () => void }) {
	const [count, setCount] = useState(0);
	const href = useRouterState({ select: (state) => state.location.href });
	return (
		<main>
			<h1>Signed in at {href}</h1>
			<output>{count}</output>
			<button onClick={() => setCount(count + 1)} type="button">
				Count
			</button>
			<button onClick={handlePasswordChange} type="button">
				Change password
			</button>
		</main>
	);
}

function Routes({
	screen,
	session,
	handleSignIn,
	handlePasswordChange,
}: {
	readonly screen: BoundaryScreen;
	readonly session: BoundarySession | undefined;
	readonly handleSignIn: () => void;
	readonly handlePasswordChange: () => void;
}) {
	const [router] = useState(() => {
		const root = createRootRoute({
			beforeLoad: permissionGuard({ session: () => (session === undefined ? undefined : { user: {} }), signIn: "/sign-in" }),
			component: Outlet,
		});
		const login = createRoute({
			component: () => (
				<main>
					<h1>Sign in</h1>
					<button onClick={handleSignIn} type="button">
						Sign in
					</button>
				</main>
			),
			getParentRoute: () => root,
			path: "/sign-in",
			validateSearch: (search: Record<string, unknown>) => (typeof search.returnTo === "string" ? { returnTo: search.returnTo } : {}),
		});
		const pages = ["/", "/private"] as const;
		const routes = pages.map((path) =>
			createRoute({
				component: () => <ProtectedScreen handlePasswordChange={handlePasswordChange} />,
				getParentRoute: () => root,
				path,
				staticData: { signedIn: true },
			}),
		);
		return createRouter({ history: screen.history, routeTree: root.addChildren([login, ...routes]) });
	});
	screen.pending = () => router.state.isLoading;
	return <RouterProvider router={router} />;
}

const alice = { id: "alice-1", user: { id: "alice" } };

export function BoundaryApp({ screen }: { readonly screen: BoundaryScreen }) {
	const [session, setSession] = useState<BoundarySession | undefined>(screen.signedIn ? alice : undefined);
	function handlePasswordChange() {
		setSession({ ...alice, id: "alice-2" });
	}
	function handleSignIn() {
		setSession(alice);
	}
	const location = screen.history.location;
	const target = location.pathname === "/sign-in" ? (new URLSearchParams(location.search).get("returnTo") ?? "/") : undefined;
	return (
		<SessionBoundary
			connect={() => undefined}
			identify={(current) => (screen.sessionIdentity ? current.id : current.user.id)}
			navigate={screen.browserHistory ? undefined : (href) => screen.history.replace(href)}
			recheck={() => undefined}
			redirectTo={target}
			session={session}
			signedOut={<Routes handlePasswordChange={handlePasswordChange} handleSignIn={handleSignIn} screen={screen} session={undefined} />}
		>
			{() => <Routes handlePasswordChange={handlePasswordChange} handleSignIn={handleSignIn} screen={screen} session={session} />}
		</SessionBoundary>
	);
}
