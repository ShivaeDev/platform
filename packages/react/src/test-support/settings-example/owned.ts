import { Effect } from "effect";
import { Missing } from "./contract.ts";
import { EntitiesRepository } from "./repository.ts";

export function owned(userId: string, entityId: number) {
	return EntitiesRepository.use((repository) => repository.findById(entityId)).pipe(
		Effect.catchTag("NoSuchElementError", () => Effect.fail(new Missing())),
		Effect.filterOrFail(
			(entity) => entity.ownerId === userId,
			() => new Missing(),
		),
	);
}
