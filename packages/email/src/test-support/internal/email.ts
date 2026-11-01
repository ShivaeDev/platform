import { Clock, Effect, Layer, Logger, Option, Redacted } from "effect";
import { pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { logMailerLayer } from "#server/Mailer.ts";
import { emailLink, inbox } from "#server/testing/adapters/inbox.ts";
import { configured, Emails, postgres } from "./fixture.ts";

export const email = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const mail = yield* inbox();
		const producer = makePgBossTesting();
		const producerContext = yield* Layer.build(
			Emails.producerLayer.pipe(
				Layer.provide(
					pgBossLayer({
						clientFactory: producer.clientFactory,
						connectionString: database.url,
					}),
				),
			),
		);
		const logs: unknown[] = [];
		return {
			database,
			id: "",
			logs,
			mail,
			producerContext,
			testing: makePgBossTesting(),
			useLog: false,
		};
	},
	inspect: (engine) => ({ logs: engine.logs }),
	layer: postgres,
	name: "transactional email over PostgreSQL and Resend HTTP",
	runIf: configured !== "",
	stages: ["provider"],
	verbs: (engine, story) => ({
		delivered: engine.mail.emails,
		enqueue: (kind: "Confirm" | "Reset", url: string) =>
			Effect.gen(function* () {
				story.tell(`enqueue alice's ${kind} email from the web process`);
				const id = yield* Emails.enqueue({ _tag: kind, url: Redacted.make(url) }).pipe(Effect.provideContext(engine.producerContext));
				engine.id = Option.getOrThrow(id);
				return engine.id;
			}),
		failedDiagnostics: () =>
			Effect.gen(function* () {
				yield* engine.testing.untilJob(Emails.queue, engine.id, "failed");
				const jobs = yield* Emails.Jobs.pipe(Effect.provideContext(engine.producerContext));
				return JSON.stringify(yield* jobs.failedJobs(Emails.queue, { limit: 10 }));
			}),
		logs: () => Effect.sync(() => JSON.stringify(engine.logs)),
		nextEmail: () => engine.mail.nextEmail,
		nextLink: () => Effect.map(engine.mail.nextEmail, emailLink),
		providerRequests: () =>
			Effect.sync(() =>
				engine.mail.endpoint.requests.map(({ headers, status }) => ({
					idempotencyKey: headers["idempotency-key"],
					status,
				})),
			),
		retry: () => {
			story.tell("make the scheduled retry due now");
			return engine.testing.runDueNow(Emails.queue);
		},
		startWorker: () =>
			Effect.gen(function* () {
				story.tell("start the email worker");
				yield* Layer.build(
					Emails.workerLayer.pipe(
						Layer.provide(engine.useLog ? logMailerLayer : engine.mail.mailerLayer),
						Layer.provide(pgBossLayer({ clientFactory: engine.testing.clientFactory, connectionString: engine.database.url })),
						Layer.provide(Logger.layer([Logger.make(({ message }) => engine.logs.push(message))])),
					),
				);
			}),
		storedRetryPlan: () =>
			Effect.gen(function* () {
				const job = yield* engine.testing.untilJob(Emails.queue, engine.id, "retry");
				return {
					at: job.startAfter.toISOString(),
					retryCount: job.retryCount,
					secondsUntilRetry: (job.startAfter.getTime() - (yield* Clock.currentTimeMillis)) / 1000,
				};
			}),
		untilIdle: () => engine.testing.waitForIdle,
	}),
});
