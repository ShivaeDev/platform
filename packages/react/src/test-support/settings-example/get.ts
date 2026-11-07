import { Effect, Schema } from "effect";
import { Settings } from "#test/settings-example/contract.ts";
import { owned } from "#test/settings-example/owned.ts";
import { SettingsRepository } from "#test/settings-example/repository.ts";
import { unavailable } from "#test/settings-example/unavailable.ts";

function failUnavailable() {
	return Effect.fail(unavailable());
}

export const get = Effect.fn("SettingsService.get")((entityId: number) =>
	Effect.gen(function* () {
		yield* owned(entityId);
		const repository = yield* SettingsRepository;
		return yield* repository
			.findById(entityId)
			.pipe(
				Effect.catchTag("NoSuchElementError", () =>
					Schema.decodeUnknownEffect(Settings)({}).pipe(Effect.map((defaults) => ({ entityId, ...defaults }))),
				),
			);
	}).pipe(
		Effect.catchTags({
			SchemaError: failUnavailable,
			SqlError: failUnavailable,
		}),
	),
);
