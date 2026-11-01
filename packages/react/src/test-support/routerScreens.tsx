import { type ErrorComponentProps, getRouteApi, Link, type NotFoundRouteProps, Outlet, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { isNotFound } from "@shivaedev/errors/taxonomy.ts";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";
import { noteQuery } from "./noteQuery.ts";
import type { routerApp } from "./routerApp.ts";
import { NoteMissing } from "./routerClient.ts";

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
	const retry = noteQuery.useRetry();
	return (
		<>
			<p role="alert">{error instanceof NoteMissing ? `${error._tag}:${error.id}` : "Could not load"}</p>
			<button
				onClick={() => {
					void retry();
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
	return isNotFound(data) ? (
		<article>
			<h1>{data.message}</h1>
		</article>
	) : (
		<h1>Page not found</h1>
	);
}

export function RouterPending() {
	return <p>Route loading</p>;
}

export function RouterSignIn() {
	const { returnTo } = getRouteApi<"/sign-in", Router>("/sign-in").useSearch<Router>();
	return <h1>Sign in to return to {returnTo}</h1>;
}

export function RouterRefused() {
	return <h1>Choose a note you can read</h1>;
}
