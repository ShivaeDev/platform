import { Effect } from "effect";
import { piEfforts } from "#adapters/effort.ts";
import { unavailable } from "#adapters/failure.ts";
import { loadSdk } from "#adapters/runtime.ts";

export const listPiModels = loadSdk.pipe(
	Effect.flatMap((sdk) => Effect.tryPromise({ catch: unavailable, try: async () => (await sdk.ModelRuntime.create()).getAvailable() })),
	Effect.map((models) =>
		models.map((model, index) => ({
			efforts: piEfforts,
			id: `${model.provider}/${model.id}`,
			isDefault: index === 0,
			name: `${model.name} (${model.provider})`,
		})),
	),
);
