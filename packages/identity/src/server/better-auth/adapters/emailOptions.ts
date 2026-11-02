import type { BetterAuthOptions } from "better-auth";
import { Effect, Schema } from "effect";
import { postgresStore } from "@shivaedev/rate-limit/adapters/postgresStore.ts";
import { rateLimit } from "@shivaedev/rate-limit/rateLimit.ts";
import { Store } from "@shivaedev/rate-limit/Store.ts";
import type { AuthEmail, BetterAuthEmails } from "#server/better-auth/emails.ts";
import type { hookRuntime } from "./hookRuntime.ts";

type Outgoing = { [TKind in AuthEmail["_tag"]]: Omit<Extract<AuthEmail, { readonly _tag: TKind }>, "url"> }[AuthEmail["_tag"]];

const Verification = Schema.Struct({ updateTo: Schema.optionalKey(Schema.String) });

export const emailOptions = Effect.fnUntraced(function* <TOptions extends BetterAuthOptions, R>(
	options: TOptions,
	emails: BetterAuthEmails<R> | undefined,
	runtime: Effect.Success<ReturnType<typeof hookRuntime<R>>>,
) {
	if (emails === undefined) {
		return options;
	}
	const { routes, deliver, window = "1 minute" } = emails;
	const store = yield* Store.pipe(Effect.provide(postgresStore));
	function send(message: Outgoing, request?: Request) {
		const url = new URL(routes[message._tag]);
		if ("token" in message) {
			url.searchParams.set("token", message.token);
		}
		return runtime.runHook(
			() =>
				rateLimit({ key: `identity:email:${JSON.stringify([message.user.id, message._tag])}`, per: 1, window }).pipe(
					Effect.provideService(Store, store),
					Effect.as(true),
					Effect.catchTag("TooManyRequests", () => Effect.succeed(false)),
					Effect.orDie,
					Effect.flatMap((allowed) => (allowed ? deliver({ ...message, url: url.href }) : Effect.void)),
				),
			request?.signal,
		);
	}
	return {
		...options,
		emailAndPassword: {
			...options.emailAndPassword,
			enabled: options.emailAndPassword?.enabled ?? false,
			onExistingUserSignUp: ({ user }, request) => send({ _tag: "AccountAlreadyExists", user }, request),
			sendResetPassword: ({ user, token }, request) => send({ _tag: "ResetPassword", token, user }, request),
		},
		emailVerification: {
			...options.emailVerification,
			sendVerificationEmail: ({ user, token }, request) => {
				const payload = token.split(".")[1] ?? "";
				const { updateTo } = Schema.decodeUnknownSync(Schema.fromJsonString(Verification))(Buffer.from(payload, "base64url").toString("utf8"));
				return send(
					updateTo === undefined ? { _tag: "ConfirmAccount", token, user } : { _tag: "ConfirmNewAddress", newEmail: updateTo, token, user },
					request,
				);
			},
		},
		user: {
			...options.user,
			changeEmail: {
				...options.user?.changeEmail,
				enabled: options.user?.changeEmail?.enabled ?? false,
				sendChangeEmailConfirmation: ({ user, newEmail, token }, request) => send({ _tag: "ApproveEmailChange", newEmail, token, user }, request),
			},
		},
	} satisfies BetterAuthOptions;
});
