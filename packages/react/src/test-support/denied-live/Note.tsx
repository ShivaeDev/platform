import { getRouteApi } from "@tanstack/react-router";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";
import type { deniedLiveApp } from "./app.tsx";

type Router = ReturnType<typeof deniedLiveApp>;
const noteRoute = getRouteApi<"/$id", Router>("/$id");
export function Note() {
	const { id } = noteRoute.useParams<Router>();
	const { client } = noteRoute.useRouteContext<Router>();
	const loaded = noteRoute.useLoaderData<Router>();
	const note = useLoaderQuery(client.api.get.query({ id }), loaded.note);
	const details = useLoaderQuery(client.api.get.query({ id: `${id}-details` }), loaded.details);
	const counts = useLoaderQuery(client.api.get.query({ id: `${id}-counts` }), loaded.counts);
	const queries = [
		{ name: "note", query: note },
		{ name: "details", query: details },
		{ name: "counts", query: counts },
	];
	const content = queries.some(({ query }) => query.denied) ? "Note not found" : note.data;
	const outputs = queries.map(({ name, query }) => {
		const text = query.denied ? "denied" : query.data;
		return (
			<output data-denied={query.denied} data-pending={query.pending} key={name}>
				{text}
			</output>
		);
	});
	return (
		<article>
			<h1>{content}</h1>
			{outputs}
		</article>
	);
}
