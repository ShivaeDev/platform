import { createAuthClient } from "better-auth/react";
import type * as Atom from "effect/reactivity/Atom";
import { type AuthActionUnavailable, authAction } from "@shivaedev/effect-react/client/authAction.ts";

export interface Credentials {
	readonly email: string;
	readonly name: string;
	readonly password: string;
}

export interface AuthFailure {
	readonly code?: string | undefined;
	readonly message?: string | undefined;
	readonly status: number;
	readonly statusText: string;
}

export interface AuthActions {
	readonly signOut: Atom.AtomResultFn<void, unknown, AuthFailure | AuthActionUnavailable>;
	readonly submit: Atom.AtomResultFn<
		{ readonly mode: "sign-in" | "sign-up"; readonly credentials: Credentials },
		unknown,
		AuthFailure | AuthActionUnavailable
	>;
}

export function makeAuth(options: {
	readonly baseUrl: string;
	readonly fetchOptions?: NonNullable<Parameters<typeof createAuthClient>[0]>["fetchOptions"];
}) {
	const client = createAuthClient({ "baseURL": options.baseUrl, ...("fetchOptions" in options ? { fetchOptions: options.fetchOptions } : {}) });
	const actions: AuthActions = {
		signOut: authAction((_, signal) => client.signOut({ fetchOptions: { signal } })),
		submit: authAction(({ mode, credentials }, signal) =>
			mode === "sign-up" ? client.signUp.email(credentials, { signal }) : client.signIn.email(credentials, { signal }),
		),
	};
	return { actions, client };
}

export type Auth = ReturnType<typeof makeAuth>;
