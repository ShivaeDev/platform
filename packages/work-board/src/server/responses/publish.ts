import { Effect } from "effect";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { Publication, publishOnce } from "#server/publication.ts";

export function publish(root: string, realRoot: string, id: string, content: string, namespace: "responses" | "handoffs" = "responses") {
	if (/^[a-zA-Z\d][a-zA-Z\d._-]*$/u.exec(id) === null) {
		return Effect.fail(new Conflict({ message: "Invalid record identity." }));
	}
	return publishOnce({ content, path: `${namespace}/${id}.md`, realRoot, root }).pipe(Effect.provide(Publication.layer));
}
