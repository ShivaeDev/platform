import { Effect } from "effect";
import { BeforeCommit } from "@shivaedev/sql/transact.ts";
import { SettingsContract } from "#test/settings-example/contract.ts";
import { SettingsService } from "#test/settings-example/service.ts";

export function handlers(beforeCommit: (keys: readonly unknown[]) => Effect.Effect<void>) {
	return SettingsContract.application.toLayer(
		Effect.gen(function* () {
			const announce = yield* BeforeCommit;
			return SettingsContract.application.of({
				"settings.get": ({ entityId }) => SettingsService.use((service) => service.get(entityId)),
				"settings.save": (input) =>
					SettingsService.use((service) => service.save(input)).pipe(
						Effect.provideService(BeforeCommit, (keys) => Effect.andThen(beforeCommit(keys), announce(keys))),
					),
			});
		}),
	);
}
