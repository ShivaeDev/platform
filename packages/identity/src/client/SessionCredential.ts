import { Context, Data, Effect } from "effect";

export class SessionCredentialUnavailable extends Data.TaggedError("SessionCredentialUnavailable")<{ readonly cause: unknown }> {}

export class SessionCredential extends Context.Service<
	SessionCredential,
	{
		readonly clear: Effect.Effect<void, SessionCredentialUnavailable>;
		readonly read: Effect.Effect<string | null, SessionCredentialUnavailable>;
		readonly write: (value: string) => Effect.Effect<void, SessionCredentialUnavailable>;
	}
>()("@shivaedev/identity/SessionCredential") {}

// A socket connect has no caller to report to, so storage that cannot answer connects without a credential.
export const storedCredential: Effect.Effect<string | null, never, SessionCredential> = Effect.gen(function* () {
	const credential = yield* SessionCredential;
	return yield* Effect.orElseSucceed(credential.read, () => null);
});
