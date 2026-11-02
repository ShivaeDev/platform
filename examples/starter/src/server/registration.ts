import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Path } from "effect";
import { RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import type { JobsEntry } from "@shivaedev/admin/jobs/entry.ts";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { AuthEmailQueue } from "#server/AuthEmailQueue.ts";
import { foundationRegistration } from "#server/admin/foundationRegistration.ts";
import { foundationWorker } from "#server/foundationWorker.ts";

export function serverRegistration<TQueue extends JobsEntry = never>(
	modules: readonly { readonly name: string; readonly queues?: readonly TQueue[] }[],
) {
	const queues = [AuthEmailQueue.queue, ...foundationWorker.queues] as const;
	const admin = foundationRegistration(...queues, ...modules.flatMap((module) => module.queues ?? []));
	return {
		admin,
		group: RpcGroup.make(),
		handlers: Layer.empty,
		migrations: {
			components: [pgBossSchema()],
			loader: Path.Path.pipe(
				Effect.flatMap((path) => Migrator.fromFileSystem(path.resolve(import.meta.dirname, "migrations"))),
				Effect.provide(NodeServices.layer),
			),
		},
		name: "foundation",
		queues,
		services: Layer.merge(AuthEmailQueue.producerLayer, admin.services),
		workers: Layer.merge(foundationWorker.workers, AuthEmailQueue.workerLayer),
	} satisfies AppModule;
}
