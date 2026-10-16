import { createHook } from "node:async_hooks";
import process from "node:process";
import { setTimeout } from "node:timers";
import { Config, Effect } from "effect";
import { afterAll } from "vitest";

export function diagnoseWorkerShutdown() {
	if (Effect.runSync(Config.String("CI").pipe(Config.withDefault(""))) === "") {
		return;
	}
	const resources = new Map<number, { readonly type: string; readonly stack: string | undefined }>();
	const hook = createHook({
		destroy(id) {
			resources.delete(id);
		},
		init(id, type) {
			if (!["PROMISE", "TickObject", "Microtask"].includes(type)) {
				resources.set(id, { stack: new Error(`Async resource created: ${type}`).stack, type });
			}
		},
	}).enable();
	afterAll(() => {
		setTimeout(() => {
			hook.disable();
			Effect.runSync(
				Effect.logWarning("Recovery matrix worker resources after suite completion", process.getActiveResourcesInfo(), [...resources.values()]),
			);
		}, 2000).unref();
	});
}
