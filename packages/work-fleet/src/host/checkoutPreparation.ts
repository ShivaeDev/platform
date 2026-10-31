import { Effect, Semaphore } from "effect";
import { dependencyInstaller } from "#host/adapters/dependencyInstaller.ts";
import { pluginBuilder } from "#host/adapters/pluginBuilder.ts";

export const checkoutPreparation = Effect.fn("FleetSupervisor.checkoutPreparation")(function* (manifest: string, log: string) {
	const installDependencies = yield* dependencyInstaller(manifest, log);
	const buildPlugin = yield* pluginBuilder(manifest, log);
	const preparing = yield* Semaphore.make(1);
	let revision = 0;
	yield* buildPlugin();
	return {
		revision: () => revision,
		withPrepared: <A, E, R>(action: Effect.Effect<A, E, R>) =>
			preparing.withPermit(
				Effect.gen(function* () {
					const dependencies = yield* installDependencies();
					if (dependencies === "failed") {
						return undefined;
					}
					if (dependencies === "installed") {
						revision += 1;
					}
					yield* buildPlugin(dependencies === "installed");
					return yield* action;
				}),
			),
	};
});
