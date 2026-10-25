import { Effect, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { invalidationKeys } from "@shivaedev/effect-contract/keys.ts";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { type EntitySettings, Missing, SaveSettings, Settings, Unavailable } from "./contract.ts";
import { EntitiesRepository, SettingsRepository } from "./repository.ts";

function owned(userId: string, entityId: number) {
	return EntitiesRepository.use((repository) => repository.findById(entityId)).pipe(
		Effect.catchTag("NoSuchElementError", () => Effect.fail(new Missing())),
		Effect.filterOrFail(
			(entity) => entity.ownerId === userId,
			() => new Missing(),
		),
	);
}
function unavailable() {
	return new Unavailable();
}
function failUnavailable() {
	return Effect.fail(unavailable());
}
export const SettingsService = defineService({
	id: "settings-example/Service",
	initialize: Effect.void,
	methods: () => ({
		get: (userId: string, entityId: number) =>
			Effect.gen(function* () {
				yield* owned(userId, entityId);
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
		save: (userId: string, input: typeof EntitySettings.Type) =>
			Effect.gen(function* () {
				yield* owned(userId, input.entityId);
				if (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) {
					return yield* SaveSettings.reject.InvalidSettings({
						field: "pageSize",
						message: "Choose between 1 and 100 rows",
					});
				}
				const repository = yield* SettingsRepository;
				const saved = yield* repository.upsert(input, {
					updateColumns: ["title", "pageSize"],
				});
				yield* invalidateOnCommit(invalidationKeys(SaveSettings.invalidates(input, saved)));
				return saved;
			}).pipe(
				Effect.catchTag("SchemaError", () => Effect.fail(unavailable())),
				transact({ onSqlError: unavailable }),
			),
	}),
	requires: [EntitiesRepository, SettingsRepository, SqlClient.SqlClient, Reactivity.Reactivity],
});
