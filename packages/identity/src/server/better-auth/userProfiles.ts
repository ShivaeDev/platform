import { Effect } from "effect";
import type { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";

export interface UserProfile {
	readonly id: string;
	readonly image: string | null;
	readonly name: string;
}

export interface UserProfileStorage {
	readonly findByIds: (userIds: readonly string[]) => Effect.Effect<readonly UserProfile[], AuthUnavailable>;
}

export const userProfiles = Effect.fn("Identity.userProfiles")(function* (
	storage: UserProfileStorage,
	userIds: readonly string[],
): Effect.fn.Return<readonly UserProfile[], AuthUnavailable> {
	const ids = [...new Set(userIds)];
	if (ids.length === 0) {
		return [];
	}
	const users = yield* storage.findByIds(ids);
	return users.map(({ id, name, image }) => ({ id, image: image ?? null, name }));
});
