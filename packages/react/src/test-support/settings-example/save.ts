import { Effect } from "effect";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { type EntitySettings, SaveSettings } from "#test/settings-example/contract.ts";
import { owned } from "#test/settings-example/owned.ts";
import { SettingsRepository } from "#test/settings-example/repository.ts";
import { unavailable } from "#test/settings-example/unavailable.ts";

export const save = Effect.fn("SettingsService.save")((input: typeof EntitySettings.Type) =>
	Effect.gen(function* () {
		yield* owned(input.entityId);
		if (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) {
			return yield* SaveSettings.reject.InvalidSettings({
				field: "pageSize",
				message: "Choose between 1 and 100 rows",
			});
		}
		const repository = yield* SettingsRepository;
		const { row: saved } = yield* repository.upsert(input, {
			updateColumns: ["title", "pageSize"],
		});
		yield* invalidateOnCommit(invalidationKeys(SaveSettings.invalidates(input, saved)));
		return saved;
	}).pipe(
		Effect.catchTag("SchemaError", () => Effect.fail(unavailable())),
		transact({ onSqlError: unavailable }),
	),
);
