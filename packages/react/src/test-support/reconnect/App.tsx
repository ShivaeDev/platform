import { useAtomValue } from "@effect/atom-react";
import { createRootRoute, createRoute, createRouter, type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { Layer, Option } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useLayoutEffect, useMemo, useState } from "react";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { useSignOut } from "#client/adapters/useSignOut.ts";
import { useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { Auth } from "#test/reconnect/auth.ts";
import { connect } from "#test/reconnect/connect.ts";

type Client = ReturnType<typeof connect>;

function Account({ client, auth, page, errors }: { client: Client; auth: Auth; page: string; errors: string[] }) {
	const query = useQuery(client.get.query({ page }));
	const status = useAtomValue(client[LiveConnection].status);
	const signOut = useSignOut(auth.signOut, { signIn: "/sign-in" });
	useLayoutEffect(() => {
		if (Option.isSome(query.cause)) {
			errors.push("Account query failed");
		}
	}, [errors, query.cause]);
	return (
		<main>
			<output data-live={status.connection} data-pending={query.pending}>
				{Option.getOrElse(query.data, () => "Loading account")}
			</output>
			<button onClick={signOut.dispatch} type="button">
				Sign out
			</button>
		</main>
	);
}

function Routes({ client, auth, errors, history }: { client: Client; auth: Auth; errors: string[]; history: RouterHistory }) {
	const [router] = useState(() => {
		const root = createRootRoute();
		const routes = ["/", "/sign-in"].map((path) =>
			createRoute({
				component: () => <Account auth={auth} client={client} errors={errors} page={path} />,
				getParentRoute: () => root,
				path,
			}),
		);
		return createRouter({ history, routeTree: root.addChildren(routes) });
	});
	return <RouterProvider router={router} />;
}

export function App({
	auth,
	url,
	errors,
	history,
	runtime,
}: {
	auth: Auth;
	url: string;
	errors: string[];
	history: RouterHistory;
	runtime: Atom.RuntimeFactory;
}) {
	const retries = useMemo(() => runtime(Layer.empty), [runtime]);
	const session = useQuery(auth.session.atom);
	const current = Option.getOrUndefined(session.data);
	if (Option.isNone(session.data)) {
		return <p>Checking session</p>;
	}
	return (
		<SessionBoundary
			connect={(_, registry) => connect(url, registry, runtime)}
			identify={(value) => value.user.id}
			recheck={auth.session.refresh}
			runtime={retries}
			session={current ?? undefined}
			signedOut={<h1>Sign in</h1>}
			signOut={auth.signOut}
		>
			{(client) => <Routes auth={auth} client={client} errors={errors} history={history} />}
		</SessionBoundary>
	);
}
