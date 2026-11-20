import { createAuthClient } from "better-auth/react";
import { Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { browserQueryStorage } from "@shivaedev/contract/adapters/browserQueryStorage.ts";
import type { AuthFailure } from "@shivaedev/identity/client/AuthFailure.ts";
import { authCall } from "@shivaedev/identity/client/adapters/authCall.ts";
import { authSession as readSession } from "@shivaedev/identity/client/adapters/authSession.ts";
import { browserSessionMemory } from "@shivaedev/identity/client/adapters/browserSessionMemory.ts";
import type { PermissionSession } from "@shivaedev/identity/PermissionSession.ts";
import { authAction } from "@shivaedev/react/client/authAction.ts";
import { authSession } from "@shivaedev/react/client/authSession.ts";
import type { Credentials } from "#client/Credentials.ts";

export type AppSession = PermissionSession & { readonly user: { readonly id: string }; readonly session?: { readonly id: string } };

export interface AuthActions {
	readonly resetPassword: Atom.AtomResultFn<{ readonly token: string; readonly newPassword: string }, unknown, AuthFailure>;
	readonly signOut: Atom.AtomResultFn<void, unknown, AuthFailure>;
	readonly submit: Atom.AtomResultFn<{ readonly mode: "sign-in" | "sign-up"; readonly credentials: Credentials }, unknown, AuthFailure>;
}

// One Layer for both, so every wipe of the remembered session also wipes the stored query results.
export const deviceStorage = Layer.merge(browserSessionMemory, browserQueryStorage);

export function makeAuth(options: {
	readonly baseUrl: string;
	readonly fetchOptions?: NonNullable<Parameters<typeof createAuthClient>[0]>["fetchOptions"];
}) {
	const client = createAuthClient({ "baseURL": options.baseUrl, ...("fetchOptions" in options ? { fetchOptions: options.fetchOptions } : {}) });
	const session = authSession(
		readSession((signal) => client.getSession({ fetchOptions: { signal }, query: { disableCookieCache: true } })),
		{ remember: deviceStorage },
	);
	const actions: AuthActions = {
		resetPassword: authAction(authCall((body, signal) => client.resetPassword({ ...body, fetchOptions: { signal } }))),
		signOut: Atom.fn<void>()(() => session.signOut(authCall((_: undefined, signal) => client.signOut({ fetchOptions: { signal } }))(undefined))),
		submit: authAction(
			authCall(({ mode, credentials }, signal) =>
				mode === "sign-up" ? client.signUp.email(credentials, { signal }) : client.signIn.email(credentials, { signal }),
			),
		),
	};
	return { actions, client, session };
}

export type Auth = ReturnType<typeof makeAuth>;
