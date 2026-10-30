import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { readBoundedJson } from "@shivaedev/http/body.ts";
import { filterStatus } from "@shivaedev/http/filterStatus.ts";
import { Note } from "#modules/notes/notes.ts";
import { NoteSource } from "#modules/notes/server/Source.ts";

const Post = Schema.Struct({ title: Note.fields.title });

export const jsonPlaceholderNotes = Layer.effect(NoteSource)(
	Effect.gen(function* () {
		const client = filterStatus(yield* HttpClient.HttpClient);
		return {
			title: (id) =>
				client.get(`https://jsonplaceholder.typicode.com/posts/${id}`).pipe(
					Effect.flatMap((response) => readBoundedJson(response, 64 * 1024, Post)),
					Effect.map((post) => post.title),
					Effect.catchTag("RemoteNotFound", (cause) => Effect.fail(Object.assign(new NotFound({ message: "Source note not found" }), { cause }))),
					Effect.mapError((cause) =>
						cause instanceof NotFound ? cause : Object.assign(new ServiceUnavailable({ message: "Could not read the source note" }), { cause }),
					),
				),
		};
	}),
).pipe(Layer.provide(FetchHttpClient.layer));
