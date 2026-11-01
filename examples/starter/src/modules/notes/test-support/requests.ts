import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { Note } from "#modules/notes/notes.ts";
import { authPost } from "#test-support/authHttp.ts";
import type { RpcAddress } from "./Engine.ts";
import { notesHttp } from "./http.ts";

function named(note: Pick<Note, "id"> & { readonly title?: string }) {
	return note.title === undefined ? `note ${note.id}` : JSON.stringify(note.title);
}

export const notesRequests = Effect.fn("AppStory.notesRequests")(function* (
	host: RpcAddress,
	name: string,
	cookie: string,
	tell: (line: string) => void,
) {
	const client = yield* notesHttp(host.baseUrl, cookie, host.origin);
	function told<A, E, R>(line: string, request: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => {
			tell(`${name} ${line}`);
			return request;
		});
	}
	return {
		create: (title: string) => told(`creates the note ${JSON.stringify(title)}`, client["notes.create"]({ title })),
		delete: (note: Pick<Note, "id" | "version"> & { readonly title?: string }) =>
			told(`deletes ${named(note)} at version ${note.version}`, client["notes.delete"]({ id: note.id, version: note.version })),
		edit: (note: Pick<Note, "id" | "version"> & { readonly title?: string }, title: string) =>
			told(
				`edits ${named(note)} at version ${note.version} to ${JSON.stringify(title)}`,
				client["notes.update"]({ id: note.id, title, version: note.version }),
			),
		import: (sourceId: number) => told(`imports source note ${sourceId}`, client["notes.import"]({ id: sourceId })),
		list: () => told("lists notes", client["notes.list"]()),
		open: (note: Pick<Note, "id"> & { readonly title?: string }) => told(`opens ${named(note)}`, client["notes.get"]({ id: note.id })),
	};
});

export type NotesRequests = Effect.Success<ReturnType<typeof notesRequests>>;

export const signOutOver = Effect.fn("AppStory.signOutOver")(function* (host: RpcAddress, cookie: string) {
	const response = yield* authPost(host.baseUrl, "sign-out", {}, cookie, host.origin);
	if (response.status !== HttpStatus.fromLiteral("OK")) {
		return yield* Effect.die(`Could not sign out: HTTP ${response.status}`);
	}
});

export const foreignOriginRequest = Effect.fn("AppStory.foreignOriginRequest")(function* (host: RpcAddress, cookie: string) {
	const response = yield* Effect.promise(() =>
		fetch(`${host.baseUrl}/rpc`, {
			body: "[]",
			headers: { "content-type": "application/ndjson", cookie, origin: "https://foreign.example" },
			method: "POST",
		}),
	);
	yield* Effect.promise(() => response.text());
	return response.status;
});
