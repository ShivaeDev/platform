import { Effect } from "effect";
import { Identity } from "@shivaedev/identity/identity.ts";
import { Missing } from "./contract.ts";
import { EntitiesRepository } from "./repository.ts";

export const owned = Effect.fn("SettingsService.owned")(function* (entityId: number) {
	const { id: userId } = yield* Identity;
	const repository = yield* EntitiesRepository;
	return yield* repository.findById(entityId).pipe(
		Effect.catchTag("NoSuchElementError", () => Effect.fail(new Missing())),
		Effect.filterOrFail(
			(entity) => entity.ownerId === userId,
			() => new Missing(),
		),
	);
});
