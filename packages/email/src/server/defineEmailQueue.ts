import { Effect, type Schema } from "effect";
import { defineQueue, type JobPayloadSchema } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import type { Email } from "#Email.ts";
import { Mailer } from "./Mailer.ts";

type Render<TSchema extends JobPayloadSchema, E, R> = (message: Schema.Schema.Type<TSchema>) => Effect.Effect<Email, E, R>;

export function defineEmailQueue<const TSchema extends JobPayloadSchema, E, R>(
	schema: TSchema,
	render: Render<TSchema, E, R>,
): ReturnType<typeof makeEmailQueue<TSchema, E, R, "transactional-email">>;
export function defineEmailQueue<const TSchema extends JobPayloadSchema, E, R, const TName extends string>(
	schema: TSchema,
	render: Render<TSchema, E, R>,
	options: { readonly name: TName },
): ReturnType<typeof makeEmailQueue<TSchema, E, R, TName>>;
export function defineEmailQueue<TSchema extends JobPayloadSchema, E, R>(
	schema: TSchema,
	render: Render<TSchema, E, R>,
	options?: { readonly name: string },
): unknown {
	return makeEmailQueue(schema, render, options?.name ?? "transactional-email");
}

function makeEmailQueue<TSchema extends JobPayloadSchema, E, R, const TName extends string>(
	schema: TSchema,
	render: Render<TSchema, E, R>,
	name: TName,
) {
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
