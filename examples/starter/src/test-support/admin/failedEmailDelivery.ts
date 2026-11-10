import { ConfigProvider, Layer } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { inbox } from "@shivaedev/test-kits/email/adapters/inbox.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { foundationAdmin } from "#test-support/admin/foundation.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";

export const failedEmailDelivery = foundationAdmin.trait("worker", "the email provider refuses delivery", function* (engine) {
	const database = yield* PostgresTestDatabase;
	const mail = yield* inbox();
	yield* mail.endpoint.scriptFault(
		"send",
		{
			kind: "status",
			reply: {
				body: { message: "provider unavailable", name: "validation_error", statusCode: HttpStatus.fromLiteral("BadRequest") },
				status: HttpStatus.fromLiteral("BadRequest"),
			},
		},
		{ repeat: true },
	);
	yield* Layer.build(
		applicationWorker({
			databaseUrl: database.url,
			poolSizes: testPoolSizes,
			replacements: Layer.merge(Layer.succeed(JobsClientFactory, engine.workerTesting.clientFactory), mail.mailerLayer),
		}).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} })))),
	);
});
