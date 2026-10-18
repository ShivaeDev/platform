import { type ErrorComponentProps, getRouteApi, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Option, Predicate } from "effect";
import { useQuery } from "#client/resultState.ts";
import type { routerApp } from "./routerApp.ts";

type Router = ReturnType<typeof routerApp>;
const noteRoute = getRouteApi<"/notes/$id", Router>("/notes/$id");

export function RouterShell() {
	const pending = useRouterState({ select: (state) => state.isLoading });
	return (
		<main>
			<Link params={{ id: "second" }} to="/notes/$id">
				Second note
			</Link>
			<output data-pending>{String(pending)}</output>
			<Outlet />
		</main>
	);
}

export function RouterNote() {
	const row = noteRoute.useLoaderData<Router>();
	const { api } = noteRoute.useRouteContext<Router>();
	const query = useQuery(api.get.query({ id: row.id }));
	return (
		<article>
			<h1>{row.title}</h1>
			<output data-query>{Option.getOrNull(query.data)?.title}</output>
		</article>
	);
}

export function RouterFailure({ error }: ErrorComponentProps) {
	return <p role="alert">{Predicate.isTagged(error, "NoteMissing") ? `${error._tag}:${"id" in error ? error.id : ""}` : "Could not load"}</p>;
}

export function RouterPending() {
	return <p>Route loading</p>;
}
