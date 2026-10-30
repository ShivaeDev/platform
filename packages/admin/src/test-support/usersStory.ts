import { Clock, DateTime, Effect, Option, Predicate } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Access } from "./Access.ts";
import { answered } from "./answers.ts";
import { postgresConfigured, postgresLayer } from "./jobsEngine.ts";
import { usersEngine } from "./usersEngine.ts";

type Role = typeof Access.Role.Type;
type Engine = Effect.Success<typeof usersEngine>;

function changeRole(engine: Engine, actor: string, userId: string, role: Role) {
	return engine
		.clientAs(actor)
		.pipe(Effect.flatMap((client) => answered(client["admin.users.changeRole"]({ role, userId }).pipe(Effect.as("assigned")))));
}

function listAs(engine: Engine, reader: string, page: { readonly limit: number; readonly cursor?: string }) {
	return Effect.gen(function* () {
		const client = yield* engine.clientAs(reader);
		return yield* answered(client["admin.users.list"](page));
	}).pipe(
		// An RPC payload outside its schema surfaces as a defect, not a typed failure.
		Effect.catchDefect((defect) =>
			defect instanceof Error && defect.message === "Schema validation failed" ? Effect.succeed("invalid page request") : Effect.die(defect),
		),
	);
}

function describePage(list: { readonly next: Option.Option<string>; readonly users: readonly { readonly id: string }[] }) {
	return {
		next: Option.match(list.next, { onNone: () => "last page", onSome: (cursor) => `after ${cursor}` }),
		users: list.users.map(({ id }) => id),
	};
}

export const usersStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => usersEngine,
	layer: postgresLayer,
	name: "admin user permissions",
	runIf: postgresConfigured,
	stages: ["users", "roles"],
	verbs: (engine, story) => ({
		answerTo: (actor: string) => Effect.sync(() => engine.answers.get(actor) ?? `${actor} has not asked`),
		assign: (actor: string, userId: string, role: Role) => {
			story.tell(`${actor} assigns ${role} to ${userId}`);
			return Effect.gen(function* () {
				engine.assignment.started = yield* Clock.currentTimeMillis;
				const answer = yield* changeRole(engine, actor, userId, role);
				engine.assignment.finished = yield* Clock.currentTimeMillis;
				engine.answers.set(actor, answer);
				return answer;
			});
		},
		creationTimesSeenBy: (reader: string) => {
			story.tell(`${reader} lists every user's creation instant`);
			return listAs(engine, reader, { limit: 100 }).pipe(
				Effect.map((list) =>
					Predicate.isString(list) ? list : Object.fromEntries(list.users.map(({ id, createdAt }) => [id, DateTime.formatIso(createdAt)])),
				),
			);
		},
		page: (reader: string, page: { readonly limit: number; readonly cursor?: string }) => {
			story.tell(`${reader} reads a page of ${page.limit} users${page.cursor === undefined ? "" : ` after ${page.cursor}`}`);
			return listAs(engine, reader, page).pipe(Effect.map((list) => (Predicate.isString(list) ? list : describePage(list))));
		},
		roleChangeLog: () =>
			Effect.sync(() =>
				engine.logs
					.filter(({ message }) => JSON.stringify(message).includes("User role changed"))
					.map(({ annotations }) => {
						const changedAt = Date.parse(String(annotations.changedAt));
						const during = changedAt >= engine.assignment.started && changedAt <= engine.assignment.finished;
						return {
							actor: annotations.actorId,
							changedAt: during ? "during the assignment" : String(annotations.changedAt),
							role: annotations.role,
							user: annotations.userId,
						};
					}),
			),
		rolesSeenBy: (reader: string) => {
			story.tell(`${reader} lists every user's role`);
			return listAs(engine, reader, { limit: 100 }).pipe(
				Effect.map((list) => (Predicate.isString(list) ? list : Object.fromEntries(list.users.map(({ id, role }) => [id, role])))),
			);
		},
		spanNames: () =>
			Effect.sync(() => engine.spans.filter(({ name }) => name.startsWith("Admin.") || name.startsWith("Platform.")).map(({ name }) => name)),
	}),
});

export function isRegistered(id: string, role: Role, createdAt?: string) {
	return usersStory.trait("users", `${id} is registered with the ${role} role${createdAt === undefined ? "" : ` at ${createdAt}`}`, ({ register }) =>
		register(id, role, createdAt === undefined ? undefined : new Date(createdAt)),
	);
}

export function alreadyAssigned(actor: string, userId: string, role: Role) {
	return usersStory.trait("roles", `${actor} has already assigned ${role} to ${userId}`, function* (engine) {
		const answer = yield* changeRole(engine, actor, userId, role);
		if (answer !== "assigned") {
			return yield* Effect.fail(`${actor} could not assign ${role} to ${userId}: ${answer}`);
		}
	});
}
