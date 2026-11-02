import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Deferred, type Duration, Effect } from "effect";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import type { AuthEmail } from "#server/better-auth/emails.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";

export const emailHost = Effect.fnUntraced(function* (window?: Duration.Input) {
	const messages: AuthEmail[] = [];
	const delivery = { available: true, held: false };
	const started = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const deliver = Effect.fnUntraced(function* (message: AuthEmail) {
		if (delivery.held) {
			yield* Deferred.succeed(started, undefined);
			yield* Deferred.await(release);
		}
		if (!delivery.available) {
			return yield* Effect.fail({ code: "MAIL_UNAVAILABLE", message: "Mail is unavailable" });
		}
		messages.push(message);
	});
	const mounted = yield* betterAuthMount(
		{
			"baseURL": "https://auth.example.test",
			database: yield* betterAuthDatabase(),
			emailAndPassword: { enabled: true, requireEmailVerification: true },
			logger: { disabled: true },
			plugins: [testUtils()],
			secret: "email-stories-secret-with-at-least-32-characters",
			user: { changeEmail: { enabled: true } },
		},
		{
			emails: {
				deliver,
				routes: {
					AccountAlreadyExists: "https://app.example.test/sign-in?from=email",
					ApproveEmailChange: "https://app.example.test/approve-email-change",
					ConfirmAccount: "https://app.example.test/confirm-account",
					ConfirmNewAddress: "https://app.example.test/confirm-new-address",
					ResetPassword: "https://app.example.test/reset-password?from=email",
				},
				...(window === undefined ? {} : { window }),
			},
			hardening: { requirePasswordForEmailChange: false },
		},
	)
		.pipe(Effect.provide(memoryStore))
		.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
	const context = yield* Effect.promise(() => mounted.auth.$context);
	yield* Effect.promise(() => context.runMigrations());
	return { auth: mounted.auth, delivery, messages, release, started };
});
