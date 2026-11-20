import { Effect } from "effect";

interface EmailAccount {
	readonly email: string;
	readonly name: string;
	readonly password: string;
}

interface EmailSignUp<TCreated> {
	readonly api: { readonly signUpEmail: (request: { readonly body: EmailAccount }) => Promise<TCreated> };
}

export function signUpEmail<TCreated>(auth: EmailSignUp<TCreated>, account: EmailAccount) {
	return Effect.tryPromise(() => auth.api.signUpEmail({ body: account }));
}
