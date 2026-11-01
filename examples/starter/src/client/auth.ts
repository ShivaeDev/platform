import { createAuthClient } from "better-auth/react";
import { Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { type AuthFailure, authAction } from "@shivaedev/react/client/authAction.ts";
import type { Credentials } from "./Credentials.ts";

export const SessionAccess = Schema.Struct({
	session: Schema.Struct({ id: Schema.String }),
	user: Schema.Struct({
		id: Schema.String,
		permissions: Schema.optionalKey(Schema.Array(Schema.Struct({ name: Schema.String, strength: Schema.Literals(["own", "any"]) }))),
	}),
});

export type AppSession = Pick<typeof SessionAccess.Type, "user"> & { readonly session?: { readonly id: string } };

export interface AuthActions {
	readonly resetPassword: Atom.AtomResultFn<{ readonly token: string; readonly newPassword: string }, unknown, AuthFailure>;
	readonly signOut: Atom.AtomResultFn<void, unknown, AuthFailure>;
	readonly submit: Atom.AtomResultFn<{ readonly mode: "sign-in" | "sign-up"; readonly credentials: Credentials }, unknown, AuthFailure>;
}

export function makeAuth(options: {
	readonly baseUrl: string;
	readonly fetchOptions?: NonNullable<Parameters<typeof createAuthClient>[0]>["fetchOptions"];
}) {
	const client = createAuthClient({ "baseURL": options.baseUrl, ...("fetchOptions" in options ? { fetchOptions: options.fetchOptions } : {}) });
	const actions: AuthActions = {
		resetPassword: authAction((body, signal) => client.resetPassword({ ...body, fetchOptions: { signal } })),
		signOut: authAction((_, signal) => client.signOut({ fetchOptions: { signal } })),
		submit: authAction(({ mode, credentials }, signal) =>
			mode === "sign-up" ? client.signUp.email(credentials, { signal }) : client.signIn.email(credentials, { signal }),
		),
	};
	return { actions, client };
}

export type Auth = ReturnType<typeof makeAuth>;
