import { Effect } from "effect";
import type { RetryAt } from "@shivaedev/jobs/server/definition.ts";
import type { Email } from "#Email.ts";
import type { MailerError } from "#server/MailerError.ts";

export function send(email: Email, idempotencyKey: string): Effect.Effect<void, MailerError | RetryAt> {
	return Effect.logInfo("Email", { ...email, idempotencyKey });
}
