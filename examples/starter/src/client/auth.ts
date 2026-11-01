import { createAuthClient } from "better-auth/react";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { AuthFailure, authAction, authCall } from "@shivaedev/react/client/authAction.ts";
import { authSession } from "@shivaedev/react/client/authSession.ts";
import type { PermissionSession } from "@shivaedev/react/permissions.ts";
import type { Credentials } from "./Credentials.ts";

export type AppSession = PermissionSession & { readonly user: { readonly id: string }; readonly session?: { readonly id: string } };

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
	const session = authSession((signal) => client.getSession({ fetchOptions: { signal }, query: { disableCookieCache: true } }));
	const actions: AuthActions = {
		resetPassword: authAction((body, signal) => client.resetPassword({ ...body, fetchOptions: { signal } })),
		signOut: Atom.fn<void>()(() =>
			authCall((_: undefined, signal) => client.signOut({ fetchOptions: { signal } }))(undefined).pipe(
				Effect.tap(() => session.refresh.pipe(Effect.mapError((cause) => new AuthFailure({ cause, code: "FAILED_TO_GET_SESSION" })))),
			),
		),
		submit: authAction(({ mode, credentials }, signal) =>
			mode === "sign-up" ? client.signUp.email(credentials, { signal }) : client.signIn.email(credentials, { signal }),
		),
	};
	return { actions, client, session };
}

export type Auth = ReturnType<typeof makeAuth>;
