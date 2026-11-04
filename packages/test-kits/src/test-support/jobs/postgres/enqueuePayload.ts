import type { Schema } from "effect";
import type { QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import type { EnqueueOptions } from "@shivaedev/jobs/server/enqueueOptions.ts";
import type { PgBossService } from "@shivaedev/jobs/server/service.ts";
import type { StoryPayload } from "./databaseEngine.ts";

export function enqueuePayload<TPayload extends StoryPayload>(
	jobs: PgBossService,
	queue: QueueDefinition<string, TPayload>,
	payload: Schema.Schema.Type<TPayload>,
	options: EnqueueOptions,
) {
	const { id: _id, singletonKey, ...rest } = options;
	const withId = options.id === undefined ? rest : { ...rest, id: options.id };
	const withKey = singletonKey === undefined ? {} : { singletonKey };
	if (queue.id === undefined) {
		return queue.key === undefined
			? jobs.enqueue({ ...queue, id: undefined, key: undefined }, payload, { ...withId, ...withKey })
			: jobs.enqueue({ ...queue, id: undefined }, payload, withId);
	}
	return queue.key === undefined ? jobs.enqueue({ ...queue, key: undefined }, payload, { ...rest, ...withKey }) : jobs.enqueue(queue, payload, rest);
}
