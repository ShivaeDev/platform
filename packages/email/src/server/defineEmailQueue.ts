import { Effect, type Schema } from "effect";
import { defineQueue, type JobPayloadSchema } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import type { Email } from "#Email.ts";
import { Mailer } from "./Mailer.ts";

export function defineEmailQueue<const TSchema extends JobPayloadSchema, E, R, const TName extends string = "transactional-email">(
	schema: TSchema,
	render: (message: Schema.Schema.Type<TSchema>) => Effect.Effect<Email, E, R>,
	options?: { readonly name: TName },
) {
	const name = options?.name ?? "transactional-email";
	const queue = defineQueue({
		name,
		queue: { retryBackoff: true, retryDelay: 30, retryLimit: 3 },
		schema,
	});
	const Jobs = makePgBoss(`@shivaedev/email/${name}`);
	const worker = queue.handle((message, job) =>
		Effect.gen(function* () {
			const email = yield* render(message);
			const mailer = yield* Mailer;
			yield* mailer.send(email, job.id);
		}),
	);
	return {
		enqueue: (message: Schema.Schema.Type<TSchema>) => Effect.flatMap(Jobs, (jobs) => jobs.enqueue(queue, message)),
		Jobs,
		producerLayer: Jobs.layer({ jobs: [queue] }),
		queue,
		worker,
		workerLayer: Jobs.layer({ jobs: [worker] }),
	};
}
