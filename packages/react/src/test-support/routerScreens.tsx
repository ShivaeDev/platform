import { type ErrorComponentProps, getRouteApi, Link, type NotFoundRouteProps, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { Predicate, Schema } from "effect";
import { useLayoutEffect } from "react";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";
import type { routerApp } from "./routerApp.ts";
import { NotFound } from "./routerClient.ts";

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
	const { client, frames, viewer } = noteRoute.useRouteContext<Router>();
	const search = noteRoute.useSearch<Router>();
	const query = useLoaderQuery(client.api.get.query({ id: row.id, page: search.page * viewer.page }), row);
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
	const { client, registry, viewer } = noteRoute.useRouteContext<Router>();
	const { id } = noteRoute.useParams<Router>();
	const { page } = noteRoute.useSearch<Router>();
	return (
		<>
			<p role="alert">{Predicate.isTagged(error, "NoteMissing") ? `${error._tag}:${"id" in error ? error.id : ""}` : "Could not load"}</p>
			<button
				onClick={() => {
					registry.refresh(client.api.get.query({ id, page: page * viewer.page }));
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

export function SharedNotFound({ data }: NotFoundRouteProps) {
	return Schema.is(NotFound)(data) ? (
		<article>
			<h1>{data.message}</h1>
			<output data-missing-id>{data.id}</output>
		</article>
	) : (
		<h1>Page not found</h1>
	);
}

export function RouterPending() {
	return <p>Route loading</p>;
}
