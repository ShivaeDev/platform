import { Config, DateTime, Effect, Layer, Redacted } from "effect";
import { Resend } from "resend";
import { parseRetryAfter } from "@shivaedev/http/parseRetryAfter.ts";
import { RetryAt } from "@shivaedev/jobs/server/definition.ts";
import type { Email } from "#Email.ts";
import { Mailer } from "#server/Mailer.ts";
import { MailerError } from "#server/MailerError.ts";

export function resendMailerLayer(options: { readonly apiKey?: Redacted.Redacted<string> } = {}) {
	return Layer.effect(
		Mailer,
		Effect.gen(function* () {
			const apiKey = options.apiKey ?? (yield* Config.Redacted("RESEND_API_KEY"));
			const resend = new Resend(Redacted.value(apiKey));
			return { send: sendEmail(resend) };
		}),
	);
}

function sendEmail(resend: Resend) {
	return (email: Email, idempotencyKey: string) =>
		Effect.gen(function* () {
			const response = yield* Effect.tryPromise({
				catch: (original) => new MailerError({ original: Redacted.make(original) }),
				try: (signal) => {
					const request = { idempotencyKey, signal };
					return resend.emails.send(email, request);
				},
			});
			if (response.error === null) {
				return;
			}
			if (response.error.statusCode === 429) {
				const now = yield* DateTime.now;
				return yield* new RetryAt({
					at: parseRetryAfter(response.headers?.["retry-after"], now) ?? DateTime.add(now, { seconds: 1 }),
					reason: "Resend rate limit",
				});
			}
			return yield* new MailerError({
				original: Redacted.make(response.error),
				...(response.error.statusCode === null ? {} : { status: response.error.statusCode }),
			});
		});
}
