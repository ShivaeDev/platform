import { Effect, Stream } from "effect";
import { BeforeCommit } from "@shivaedev/effect-sql/transact.ts";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { AppChanges } from "@shivaedev/platform/server/appHost.ts";
import { SettingsApplication, settings } from "./contract.ts";
import { SettingsService } from "./Service.ts";

export function handlers(beforeCommit: (keys: readonly unknown[]) => Effect.Effect<void>) {
	return SettingsApplication.toLayer(
		Effect.gen(function* () {
			const service = yield* SettingsService;
			const changes = yield* AppChanges;
			const announce = yield* BeforeCommit;
			return SettingsApplication.of({
				"settings.get": ({ entityId }) => Effect.flatMap(Identity, ({ id }) => service.get(id, entityId)),
				"settings.save": (input) =>
					Effect.flatMap(Identity, ({ id }) => service.save(id, input)).pipe(
						Effect.provideService(BeforeCommit, (keys) => Effect.andThen(beforeCommit(keys), announce(keys))),
					),
				subscribe: ({ entityId }) =>
					Stream.unwrap(
						Effect.gen(function* () {
							yield* service.get((yield* Identity).id, entityId);
							return changes.stream([settings.item(entityId)]);
						}),
					),
			});
		}),
	);
}
