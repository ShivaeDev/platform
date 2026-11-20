import { Layer } from "effect";
import { RpcGroup } from "effect/rpc";
import type { JobsEntry } from "@shivaedev/admin/jobs/entry.ts";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { migrationsIn } from "@shivaedev/server/adapters/migrationsIn.ts";
import { AuthEmailQueue } from "#server/AuthEmailQueue.ts";
import { foundationRegistration } from "#server/admin/foundationRegistration.ts";
import { foundationWorker } from "#server/foundationWorker.ts";

export function serverRegistration<const TModules extends readonly Pick<AppModule, "queues">[]>(modules: TModules) {
	const queues = [AuthEmailQueue.queue, ...foundationWorker.queues] as const;
	const admin = foundationRegistration(...queues, ...featureQueues(modules));
	return {
		admin,
		group: RpcGroup.make(),
		handlers: Layer.empty,
		migrations: { ...migrationsIn(import.meta.dirname), components: [pgBossSchema()] },
		name: "foundation",
		queues,
		services: Layer.merge(AuthEmailQueue.producerLayer, admin.services),
		workers: Layer.merge(foundationWorker.workers, AuthEmailQueue.workerLayer),
	} satisfies AppModule;
}

type FeatureQueue<TModule> = TModule extends { readonly queues: readonly (infer TQueue extends JobsEntry)[] } ? TQueue : never;

function featureQueues<const TModules extends readonly Pick<AppModule, "queues">[]>(modules: TModules): FeatureQueue<TModules[number]>[];
function featureQueues(modules: readonly Pick<AppModule, "queues">[]) {
	return modules.flatMap((module) => module.queues ?? []);
}
