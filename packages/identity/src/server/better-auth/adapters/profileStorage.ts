import type { AuthContext } from "better-auth";
import { Effect } from "effect";
import type { UserProfile, UserProfileStorage } from "#server/better-auth/userProfiles.ts";
import { providerFailure } from "#server/providerFailure.ts";

export function profileStorage({ adapter }: { readonly adapter: Pick<AuthContext["adapter"], "findMany"> }): UserProfileStorage {
	return {
		findByIds: (userIds) =>
			Effect.tryPromise(() =>
				adapter.findMany<UserProfile>({
					limit: userIds.length,
					model: "user",
					select: ["id", "name", "image"],
					where: [{ field: "id", operator: "in", value: [...userIds] }],
				}),
			).pipe(Effect.catch((error) => providerFailure(error.cause))),
	};
}
