import type { JobRegistration } from "#definition.ts";
import type { PgBossDefinition, PgBossLayerOptions } from "#service.ts";

export function jobModule<TIdentifier extends string, const TJobs extends readonly JobRegistration[], R = never>(
	layer: PgBossDefinition<TIdentifier>["layer"],
	options: PgBossLayerOptions<TJobs, R>,
) {
	const queues = options.jobs.map((job) => {
		if (job._tag === "QueueDefinition") {
			return job;
		}
		return job._tag === "QueueWorker" ? job.queue : job.schedule;
	});
	return {
		queues,
		workers: layer(options),
	};
}
