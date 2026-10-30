import type { Auth } from "better-auth";
import { Effect } from "effect";
import type { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { providerFailure } from "#server/providerFailure.ts";

export interface UserProfile {
	readonly id: string;
	readonly image: string | null;
	readonly name: string;
}

export const userProfiles = Effect.fn("Platform.userProfiles")(function* (
	auth: { readonly $context: Promise<{ readonly adapter: Pick<Awaited<Auth["$context"]>["adapter"], "findMany"> }> },
	userIds: readonly string[],
): Effect.fn.Return<readonly UserProfile[], AuthUnavailable> {
	const ids = [...new Set(userIds)];
	if (ids.length === 0) {
		return [];
	}
	const users = yield* Effect.tryPromise(async () => {
		const { adapter } = await auth.$context;
		return adapter.findMany<UserProfile>({
			limit: ids.length,
			model: "user",
			select: ["id", "name", "image"],
			where: [{ field: "id", operator: "in", value: ids }],
		});
	}).pipe(Effect.catch((error) => providerFailure(error.cause)));
	return users.map(({ id, name, image }) => ({ id, image: image ?? null, name }));
});
