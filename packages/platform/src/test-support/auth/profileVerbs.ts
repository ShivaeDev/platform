import { Effect, Logger } from "effect";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { userProfiles } from "@shivaedev/identity/server/better-auth/userProfiles.ts";
import type { AdminHost } from "./adminHost.ts";

export function profileVerbs(host: AdminHost, story: { tell: (line: string) => void }) {
	return {
		lookupProfiles: Effect.fn("AuthStory.lookupProfiles")(function* (ids: readonly string[]) {
			story.tell("look up public profiles through Better Auth");
			const start = host.queries.length;
			const logs: unknown[] = [];
			const logger = Logger.make(({ message }) => logs.push(message));
			const result = yield* userProfiles(host.auth, ids).pipe(Effect.result, Effect.provide(Logger.layer([logger])));
			return { logs, queries: host.queries.slice(start), result };
		}),
		renameProfile: Effect.fn("AuthStory.renameProfile")(function* (headers: Headers, name: string) {
			story.tell(`the signed-in user changes their name to ${name}`);
			yield* Effect.promise(() => host.auth.api.updateUser({ body: { name }, headers }));
		}),
		signInProfile: Effect.fn("AuthStory.signInProfile")(function* (fields: {
			readonly email: string;
			readonly name: string;
			readonly image?: string;
		}) {
			story.tell(`sign in ${fields.name} through Better Auth`);
			return yield* Effect.promise(() => signedInUser(host.auth, fields));
		}),
		stopAuthStorage: Effect.fn("AuthStory.stopAuthStorage")(function* () {
			story.tell("close the auth storage pool");
			yield* host.stopStorage;
		}),
	};
}
