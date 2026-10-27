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
	stages: [],
	verbs: ({ clientAs }, story) => ({
		assign: Effect.fn("AdminUsers.assign")(function* (actor: string, userId: string, role: typeof Access.Role.Type) {
			story.tell(`${actor} assigns ${role} to ${userId}`);
			const client = yield* clientAs(actor);
			yield* client["admin.users.changeRole"]({ role, userId });
		}),
		list: Effect.fn("AdminUsers.list")(function* (id: string) {
			story.tell(`${id} reads users`);
			const client = yield* clientAs(id);
			return yield* client["admin.users.list"]({ limit: 20 });
		}),
	}),
});
