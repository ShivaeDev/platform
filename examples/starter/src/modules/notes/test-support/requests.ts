import { Effect } from "effect";
import { authPost } from "#test-support/authHttp.ts";
import type { RunningHost } from "#test-support/host.ts";
import { notesHttp } from "./http.ts";

export function requests(host: RunningHost, tell: (line: string) => void) {
	const signOut = Effect.fn("AppStory.signOut")(function* (cookie: string) {
		tell("the signed-in user signs out");
		const response = yield* authPost(host.baseUrl, "sign-out", {}, cookie, host.origin);
		if (response.status !== 200) {
			return yield* Effect.die(`Could not sign out: HTTP ${response.status}`);
		}
	});
	const notes = Effect.fn("AppStory.notes")(function* (cookie = "") {
		const client = yield* notesHttp(host.baseUrl, cookie, host.origin);
		function call<A, E, R>(line: string, effect: Effect.Effect<A, E, R>) {
			return Effect.suspend(() => {
				tell(line);
				return effect;
			});
		}
		return {
			create: (input: Parameters<(typeof client)["notes.create"]>[0]) =>
				call(`create note ${JSON.stringify(input.title)}`, client["notes.create"](input)),
			delete: (input: Parameters<(typeof client)["notes.delete"]>[0]) =>
				call(`delete note ${input.id} at version ${input.version}`, client["notes.delete"](input)),
			get: (input: Parameters<(typeof client)["notes.get"]>[0]) => call(`open note ${input.id}`, client["notes.get"](input)),
			list: () => call("list notes", client["notes.list"]()),
			update: (input: Parameters<(typeof client)["notes.update"]>[0]) =>
				call(`edit note ${input.id} at version ${input.version}`, client["notes.update"](input)),
			whoami: () => call("read the signed-in profile", client["notes.whoami"]()),
		};
	});
	const foreignRequest = Effect.fn("AppStory.foreignRequest")(function* (cookie: string) {
		tell("a foreign origin calls protected RPC");
		const response = yield* Effect.promise(() =>
			fetch(`${host.baseUrl}/rpc`, {
				body: "[]",
				headers: { "content-type": "application/ndjson", cookie, origin: "https://foreign.example" },
				method: "POST",
			}),
		);
		yield* Effect.promise(() => response.text());
		return response;
	});
	return { foreignRequest, notes, signOut };
}
