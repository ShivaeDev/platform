import { resolve } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import type { QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { foundationRegistration } from "#server/admin/foundationRegistration.ts";
import { AuthEmailQueue } from "./AuthEmailQueue.ts";
import { foundationWorker } from "./foundationWorker.ts";

export function serverRegistration(queues: readonly QueueDefinition[]) {
	const admin = foundationRegistration(queues);
	return {
		admin,
		group: RpcGroup.make(),
		handlers: Layer.empty,
		migrations: {
			components: [pgBossSchema()],
			loader: Migrator.fromFileSystem(resolve(import.meta.dirname, "migrations")).pipe(Effect.provide(NodeServices.layer)),
		},
		name: "foundation",
		queues: [AuthEmailQueue.queue, ...foundationWorker.queues],
		services: Layer.merge(AuthEmailQueue.producerLayer, admin.services),
		workers: Layer.merge(foundationWorker.workers, AuthEmailQueue.workerLayer),
	} satisfies AppModule;
}
