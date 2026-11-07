import type { BetterAuthOptions } from "better-auth";
import { Effect, Redacted, Schema } from "effect";
import { postgresStore } from "@shivaedev/rate-limit/adapters/postgresStore.ts";
import { rateLimit } from "@shivaedev/rate-limit/rateLimit.ts";
import { Store } from "@shivaedev/rate-limit/Store.ts";
import type { hookRuntime } from "#server/better-auth/adapters/hookRuntime.ts";
import type { AuthEmail, BetterAuthEmails } from "#server/better-auth/emails.ts";

type Outgoing = { [TKind in AuthEmail["_tag"]]: Omit<Extract<AuthEmail, { readonly _tag: TKind }>, "url"> }[AuthEmail["_tag"]];

const Verification = Schema.Struct({ updateTo: Schema.optionalKey(Schema.String) });
const SignUp = Schema.Struct({ "callbackURL": Schema.optionalKey(Schema.String) });

function continuation(url: string) {
	return new URL(url).searchParams.get("callbackURL");
}

export const emailOptions = Effect.fnUntraced(function* <TOptions extends BetterAuthOptions, R>(
	options: TOptions,
	emails: BetterAuthEmails<R> | undefined,
	runtime: Effect.Success<ReturnType<typeof hookRuntime<R>>>,
) {
	if (emails === undefined) {
		return options;
	}
	const { routes, deliver, window = "1 minute", windows } = emails;
	const store = yield* Store.pipe(Effect.provide(postgresStore));
	function send(message: Outgoing, request?: Request, callback?: string | null) {
		const url = new URL(routes[message._tag]);
		if (callback && URL.parse(callback, url.origin)?.origin === url.origin) {
			url.searchParams.set("callbackURL", callback);
		}
		if ("token" in message) {
			url.searchParams.set("token", Redacted.value(message.token));
		}
		return runtime.runHook(
			() =>
				rateLimit({
					key: `identity:email:${JSON.stringify([message.user.id, message._tag])}`,
					per: 1,
					window: windows?.[message._tag] ?? window,
				}).pipe(
					Effect.provideService(Store, store),
					Effect.as(true),
					Effect.catchTag("TooManyRequests", () => Effect.succeed(false)),
					Effect.orDie,
					Effect.flatMap((allowed) => (allowed ? deliver({ ...message, url: Redacted.make(url.href) }) : Effect.void)),
				),
			request?.signal,
		);
	}
	return {
		...options,
		emailAndPassword: {
			...options.emailAndPassword,
			enabled: options.emailAndPassword?.enabled ?? false,
			onExistingUserSignUp: async ({ user }, request) =>
				send(
					{ _tag: "AccountAlreadyExists", user },
					request,
					request === undefined ? undefined : Schema.decodeUnknownSync(SignUp)(await request.json()).callbackURL,
				),
			sendResetPassword: ({ user, token, url }, request) =>
				send({ _tag: "ResetPassword", token: Redacted.make(token), user }, request, continuation(url)),
		},
		emailVerification: {
			...options.emailVerification,
			sendVerificationEmail: ({ user, token, url }, request) => {
				const payload = token.split(".")[1] ?? "";
				const { updateTo } = Schema.decodeUnknownSync(Schema.fromJsonString(Verification))(Buffer.from(payload, "base64url").toString("utf8"));
				return send(
					updateTo === undefined
						? { _tag: "ConfirmAccount", token: Redacted.make(token), user }
						: { _tag: "ConfirmNewAddress", newEmail: updateTo, token: Redacted.make(token), user },
					request,
					continuation(url),
				);
			},
		},
		user: {
			...options.user,
			changeEmail: {
				...options.user?.changeEmail,
				enabled: options.user?.changeEmail?.enabled ?? false,
				sendChangeEmailConfirmation: ({ user, newEmail, token, url }, request) =>
					send({ _tag: "ApproveEmailChange", newEmail, token: Redacted.make(token), user }, request, continuation(url)),
			},
		},
	} satisfies BetterAuthOptions;
});
