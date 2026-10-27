import { type ErrorComponentProps, getRouteApi, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { Predicate } from "effect";
import { useLayoutEffect } from "react";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";
import type { routerApp } from "./routerApp.ts";

type Router = ReturnType<typeof routerApp>;
const noteRoute = getRouteApi<"/notes/$id", Router>("/notes/$id");

export function RouterShell() {
	const pending = useRouterState({ select: (state) => state.isLoading });
	return (
		<main>
			<input defaultValue="Shell draft" name="shell" />
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
	const { api, frames } = noteRoute.useRouteContext<Router>();
	const search = noteRoute.useSearch<Router>();
	const query = useLoaderQuery(api.get.query({ id: row.id, page: search.page }), row);
	useLayoutEffect(() => {
		frames.push(query.data.title);
	}, [frames, query.data.title]);
	return (
		<article>
			<h1>{row.title}</h1>
			<output data-query>{query.data.title}</output>
		</article>
	);
}

export function RouterFailure({ error }: ErrorComponentProps) {
	const router = useRouter();
	const { api, registry } = noteRoute.useRouteContext<Router>();
	const { id } = noteRoute.useParams<Router>();
	const { page } = noteRoute.useSearch<Router>();
	return (
		<>
			<p role="alert">{Predicate.isTagged(error, "NoteMissing") ? `${error._tag}:${"id" in error ? error.id : ""}` : "Could not load"}</p>
			<button
				onClick={() => {
					registry.refresh(api.get.query({ id, page }));
					void router.invalidate();
				}}
				type="button"
			>
				Retry
			</button>
		</>
	);
}

export function RouterNotFound() {
	return <h1>Note not found</h1>;
}

export function RouterPending() {
	return <p>Route loading</p>;
}
