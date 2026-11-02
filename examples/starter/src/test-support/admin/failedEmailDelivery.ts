import { Effect, Layer, Redacted } from "effect";
import { Mailer } from "@shivaedev/email/server/Mailer.ts";
import { MailerError } from "@shivaedev/email/server/MailerError.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";
import { foundationAdmin } from "./foundation.ts";

export const failedEmailDelivery = foundationAdmin.trait("worker", "the email provider refuses delivery", function* (engine) {
	const database = yield* PostgresTestDatabase;
	yield* Layer.build(
		applicationWorker({
			databaseUrl: database.url,
			poolSizes: testPoolSizes,
			replacements: Layer.merge(
				Layer.succeed(JobsClientFactory, engine.workerTesting.clientFactory),
				Layer.succeed(Mailer, { send: () => Effect.fail(new MailerError({ original: Redacted.make("provider unavailable") })) }),
			),
		}),
	);
});
