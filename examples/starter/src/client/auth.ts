import { createAuthClient } from "better-auth/react";

export interface Credentials {
	readonly email: string;
	readonly name: string;
	readonly password: string;
}

export interface AuthActions {
	readonly signOut: () => Promise<string | undefined>;
	readonly submit: (mode: "sign-in" | "sign-up", credentials: Credentials) => Promise<string | undefined>;
}

export function makeAuth(options: {
	readonly baseUrl: string;
	readonly fetchOptions?: NonNullable<Parameters<typeof createAuthClient>[0]>["fetchOptions"];
}) {
	const client = createAuthClient({ "baseURL": options.baseUrl, ...("fetchOptions" in options ? { fetchOptions: options.fetchOptions } : {}) });
	const actions: AuthActions = {
		signOut: async () => {
			const result = await client.signOut();
			return result.error?.message;
		},
		submit: async (mode, credentials) => {
			const result = mode === "sign-up" ? await client.signUp.email(credentials) : await client.signIn.email(credentials);
			return result.error?.message;
		},
	};
	return { actions, client };
}

export type Auth = ReturnType<typeof makeAuth>;
