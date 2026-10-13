import { Effect, Layer } from "effect";
import { defaultClientFactory } from "@shivaedev/effect-pg-boss/client.ts";
import { toPgBossError } from "@shivaedev/effect-pg-boss/error.ts";
import { deadLetterQueueName } from "@shivaedev/effect-pg-boss/health.ts";
import { CountWords, NoteJobs } from "./noteJobs.ts";

export function noteProducer(connectionString: string) {
	return Layer.unwrap(
		Effect.sync(() => {
			const client = defaultClientFactory({ connectionString });
			const queues = Effect.tryPromise({
				catch: (error) => toPgBossError("register", error),
				try: async () => {
					const deadLetter = deadLetterQueueName(CountWords.name);
					await client.createQueue(deadLetter);
					await client.createQueue(CountWords.name, { ...CountWords.queueOptions, deadLetter });
				},
			});
			return Layer.effectDiscard(queues).pipe(Layer.provideMerge(NoteJobs.layer({ clientFactory: () => client, connectionString, jobs: [] })));
		}),
	);
}
