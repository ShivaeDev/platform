import { Effect } from "effect";
import type { AppModule } from "#AppModule.ts";
import { DuplicateModuleQueue } from "#DuplicateModuleQueue.ts";

interface QueueOwner {
	readonly adminPage: string | undefined;
	readonly name: string | undefined;
}

function queueOwner(module: AppModule): QueueOwner {
	return { adminPage: module.admin?.pages[0]?.id, name: module.module === undefined ? module.name : module.module.declaration.name };
}

export const moduleQueues = Effect.fnUntraced(function* (modules: readonly AppModule[]) {
	const owners = new Map<string, QueueOwner>();
	for (const module of modules) {
		for (const queue of module.queues ?? []) {
			const first = owners.get(queue.name);
			const second = queueOwner(module);
			if (first !== undefined) {
				return yield* new DuplicateModuleQueue({
					firstAdminPage: first.adminPage,
					firstModule: first.name,
					queue: queue.name,
					secondAdminPage: second.adminPage,
					secondModule: second.name,
				});
			}
			owners.set(queue.name, second);
		}
	}
	return modules.flatMap((module) => module.queues ?? []);
});
