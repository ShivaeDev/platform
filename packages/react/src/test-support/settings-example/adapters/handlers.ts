import { Effect, Stream } from "effect";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { BeforeCommit } from "@shivaedev/sql/transact.ts";
import { SettingsApplication, settings } from "#test/settings-example/contract.ts";
import { SettingsService } from "#test/settings-example/service.ts";

export function handlers(beforeCommit: (keys: readonly unknown[]) => Effect.Effect<void>) {
	return SettingsApplication.toLayer(
		Effect.gen(function* () {
			const changes = yield* LiveServer;
			const announce = yield* BeforeCommit;
			return SettingsApplication.of({
				"settings.get": ({ entityId }) => SettingsService.use((service) => service.get(entityId)),
				"settings.save": (input) =>
					SettingsService.use((service) => service.save(input)).pipe(
						Effect.provideService(BeforeCommit, (keys) => Effect.andThen(beforeCommit(keys), announce(keys))),
					),
				subscribe: ({ entityId }) =>
					Stream.unwrap(
						Effect.gen(function* () {
							yield* SettingsService.use((service) => service.get(entityId));
							return yield* changes.stream([settings.item(entityId)]);
						}),
					),
			});
		}),
	);
}
