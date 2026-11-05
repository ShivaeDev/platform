import { Effect } from "effect";
import type { RetryAt } from "@shivaedev/jobs/server/definition.ts";
import type { Email } from "#Email.ts";
import type { MailerError } from "#server/MailerError.ts";

export const send = Effect.fn("Mailer.send")(function* (email: Email, idempotencyKey: string): Effect.fn.Return<void, MailerError | RetryAt> {
	yield* Effect.logInfo("Email", { ...email, idempotencyKey });
});
