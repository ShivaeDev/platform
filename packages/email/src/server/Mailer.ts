import { Effect } from "effect";
import type { RetryAt } from "@shivaedev/jobs/server/definition.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import type { Email } from "#Email.ts";
import type { MailerError } from "./MailerError.ts";

export const Mailer = defineService({
	id: "@shivaedev/email/Mailer",
	initialize: Effect.void,
	methods: () => ({
		send: (email: Email, idempotencyKey: string): Effect.Effect<void, MailerError | RetryAt> => Effect.logInfo("Email", { ...email, idempotencyKey }),
	}),
	requires: [],
});

export const logMailerLayer = Mailer.layer;
