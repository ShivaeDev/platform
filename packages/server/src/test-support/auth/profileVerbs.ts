import { Effect, Logger, Predicate, Result } from "effect";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { userProfiles } from "@shivaedev/identity/server/better-auth/userProfiles.ts";
import { errorWords } from "#test/answers.ts";
import type { AdminHost } from "./adminHost.ts";

export function profileVerbs(host: AdminHost, story: { tell: (line: string) => void }) {
	let lookup:
		| { readonly logs: unknown[]; readonly queries: unknown[]; readonly result: Result.Result<readonly { readonly name: string }[], unknown> }
		| undefined;
	return {
		lookupFailure: () =>
			Effect.sync(() =>
				lookup === undefined || Result.isSuccess(lookup.result)
					? "no failed lookup"
					: { cause: Predicate.hasProperty(lookup.result.failure, "cause") ? "kept" : "none", text: String(lookup.result.failure) },
			),
		lookupProfiles: Effect.fn("AuthStory.lookupProfiles")(function* (ids: readonly string[]) {
			story.tell(`public profiles are looked up for ${ids.length} ids through Better Auth`);
			const start = host.queries.length;
			const logs: unknown[] = [];
			const logger = Logger.make(({ message }) => logs.push(message));
			const result = yield* userProfiles(host.auth, ids).pipe(Effect.result, Effect.provide(Logger.layer([logger])));
			lookup = { logs, queries: host.queries.slice(start).map(({ values }) => values), result };
			return Result.isSuccess(result)
				? [...result.success].sort((left, right) => left.name.localeCompare(right.name))
				: `failed with ${errorWords(result.failure)}`;
		}),
		profileQueries: () => Effect.sync(() => lookup?.queries ?? []),
		providerLogs: () => Effect.sync(() => lookup?.logs ?? []),
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
			story.tell("the auth storage pool closes");
			yield* host.stopStorage;
		}),
	};
}
