import type { JobRegistration, QueueDefinition, QueueWorker, ScheduledWorker } from "#server/definition.ts";
import type { PgBossDefinition, PgBossLayerOptions } from "#server/service.ts";

export function jobModule<TIdentifier extends string, const TJobs extends readonly JobRegistration[], R = never>(
	layer: PgBossDefinition<TIdentifier>["layer"],
	options: PgBossLayerOptions<TJobs, R>,
) {
	return {
		queues: moduleQueues(options.jobs),
		workers: layer(options),
	};
}

type ModuleQueue<TJob extends JobRegistration> = TJob extends QueueDefinition
	? TJob
	: TJob extends QueueWorker
		? TJob["queue"]
		: TJob extends ScheduledWorker
			? TJob["schedule"]
			: never;

function moduleQueues<const TJobs extends readonly JobRegistration[]>(jobs: TJobs): ModuleQueue<TJobs[number]>[];
function moduleQueues(jobs: readonly JobRegistration[]) {
	return jobs.map((job) => {
		if (job._tag === "QueueDefinition") {
			return job;
		}
		return job._tag === "QueueWorker" ? job.queue : job.schedule;
	});
}
