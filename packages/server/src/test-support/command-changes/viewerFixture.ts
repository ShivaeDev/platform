import { Effect, Layer, Option, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { command } from "@shivaedev/contract/operation.ts";
import {
	Authenticated,
	AuthenticatedUser,
	AuthenticatedUserWithProviderAccounts,
	MaybeAuthenticated,
	RequestTracing,
} from "@shivaedev/identity/middleware.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { authenticatedUserLayer, authenticatedUserWithProviderAccountsLayer } from "@shivaedev/identity/server/session.ts";
import { Api, handlers, Note, notes, saveNote } from "./fixture.ts";

function signedInSession(id: string) {
	return { user: { email: `${id}@example.test`, id, name: id, providerAccounts: Effect.succeed([]) } };
}

export function viewerFixture() {
	const viewers: string[] = [];
	function commands<const TName extends string>(name: TName) {
		return contract(name, {
			commands: [
				command("save", {
					invalidates: (_input, result, viewer = Option.none()) => {
						viewers.push(Option.isSome(viewer) ? viewer.value.id : "anonymous");
						return [notes.item(result.id)];
					},
					payload: { title: Schema.String },
					success: Note,
				}),
			],
		});
	}
	const required = commands("required").middleware(Authenticated).middleware(RequestTracing).application;
	const optional = commands("optional").middleware(MaybeAuthenticated).middleware(RequestTracing).application;
	const user = commands("user").middleware(RequestTracing).middleware(AuthenticatedUser).application;
	const accounts = commands("accounts").middleware(AuthenticatedUserWithProviderAccounts).middleware(RequestTracing).application;
	const api = Api.merge(required, optional, user, accounts);
	const application = Layer.mergeAll(
		handlers,
		required.toLayer({ "required.save": (input) => saveNote(input).pipe(Effect.catchTag("Conflict", Effect.die)) }),
		optional.toLayer({ "optional.save": (input) => saveNote(input).pipe(Effect.catchTag("Conflict", Effect.die)) }),
		user.toLayer({ "user.save": (input) => saveNote(input).pipe(Effect.catchTag("Conflict", Effect.die)) }),
		accounts.toLayer({ "accounts.save": (input) => saveNote(input).pipe(Effect.catchTag("Conflict", Effect.die)) }),
	).pipe(Layer.provideMerge([authenticatedUserLayer(), authenticatedUserWithProviderAccountsLayer()]));
	const sessions = Layer.succeed(SessionPolicy, {
		origin: () => true,
		provider: {
			get: (headers) => Effect.succeed(Option.map(Option.fromUndefinedOr(headers.authorization), signedInSession)),
		},
	});
	return { api, application, sessions, viewers };
}
