import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Access } from "./Access.ts";
import { postgresConfigured, postgresLayer } from "./jobsEngine.ts";
import { usersEngine } from "./usersEngine.ts";

export const usersStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => usersEngine,
	layer: postgresLayer,
	name: "admin user permissions",
	runIf: postgresConfigured,
	stages: ["users"],
	verbs: ({ clientAs, logs }, story) => ({
		assign: Effect.fn("AdminUsers.assign")(function* (actor: string, userId: string, role: typeof Access.Role.Type) {
			story.tell(`${actor} assigns ${role} to ${userId}`);
			const client = yield* clientAs(actor);
			yield* client["admin.users.changeRole"]({ role, userId });
		}),
		list: Effect.fn("AdminUsers.list")(function* (id: string, page: { readonly limit: number; readonly cursor?: string } = { limit: 20 }) {
			story.tell(`${id} reads ${page.limit} users${page.cursor === undefined ? "" : ` after ${page.cursor}`}`);
			const client = yield* clientAs(id);
			return yield* client["admin.users.list"](page);
		}),
		logs: () => logs,
	}),
});

export function isRegistered(id: string, role: typeof Access.Role.Type) {
	return usersStory.trait("users", `${id} is registered with the ${role} role`, ({ register }) => register(id, role));
}
