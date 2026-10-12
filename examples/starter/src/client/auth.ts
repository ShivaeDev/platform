import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export interface Credentials {
	readonly email: string;
	readonly name: string;
	readonly password: string;
}

export interface AuthActions {
	readonly signOut: () => Promise<string | undefined>;
	readonly submit: (mode: "sign-in" | "sign-up", credentials: Credentials) => Promise<string | undefined>;
}

export const authActions: AuthActions = {
	signOut: async () => {
		const result = await authClient.signOut();
		return result.error?.message;
	},
	submit: async (mode, credentials) => {
		const result = mode === "sign-up" ? await authClient.signUp.email(credentials) : await authClient.signIn.email(credentials);
		return result.error?.message;
	},
};
