import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Exit, Layer, Option, Scope } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { countWords } from "@shivaedev/test/answers.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Admin, foundation } from "#admin/modules.ts";
import { notesHttp } from "#modules/notes/test-support/http.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { answer } from "#test-support/answers.ts";
import { developmentServer } from "#test-support/developmentServer.ts";
import { type RunningHost, startHost } from "#test-support/host.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";
import { postgres } from "#test-support/postgres.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";

const { UsersPage } = foundation;

interface AdminEngine {
	readonly cookies: Map<string, string>;
	readonly host: RunningHost;
	url: string;
	readonly userIds: Map<string, string>;
}

function nameOf(engine: AdminEngine, userId: unknown) {
	return [...engine.userIds].find(([, id]) => id === userId)?.[0] ?? "an unknown account";
}

function roleChange(engine: AdminEngine, annotations: Readonly<Record<string, unknown>>) {
	return {
		by: nameOf(engine, annotations.actorId),
		role: annotations.role,
		stamped: typeof annotations.changedAt === "string" && !Number.isNaN(Date.parse(annotations.changedAt)) ? "with a time" : "without a time",
		user: nameOf(engine, annotations.userId),
	};
}

export const adminHost = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const host = yield* startHost();
		const engine: AdminEngine = { cookies: new Map(), host, url: host.baseUrl, userIds: new Map() };
		return engine;
	},
	inspect: ({ host, url }) => ({ baseUrl: host.baseUrl, url }),
	layer: postgres,
	name: "admin host",
	stages: ["accounts", "development"],
	verbs: (engine, story) => {
		const adminOf = Effect.fn("AdminStory.adminOf")(function* (name: string) {
			return yield* makeClient(UsersPage.contract, {
				group: Admin.group,
				headers: { cookie: engine.cookies.get(name) ?? "", origin: engine.url },
				url: `${engine.url}/rpc`,
				webSocketConstructor: layerWebSocketConstructorWS,
			}).client;
		});
		return {
			callsAuthAdmin: (name: string, operation: "create-user" | "set-role" | "update-user", target: string) =>
				Effect.promise(async () => {
					story.tell(`${name} calls Better Auth's own admin ${operation} endpoint for ${target}`);
					const userId = engine.userIds.get(target) ?? "missing";
					const bodies = {
						"create-user": { email: `${target}@app.test`, name: target, role: "owner" },
						"set-role": { role: "user", userId },
						"update-user": { data: { role: "user" }, userId },
					};
					const response = await fetch(`${engine.host.baseUrl}/api/auth/admin/${operation}`, {
						body: JSON.stringify(bodies[operation]),
						headers: { "content-type": "application/json", cookie: engine.cookies.get(name) ?? "", origin: engine.host.origin },
						method: "POST",
					});
					await response.text();
					return response.status;
				}),
			changesRole: Effect.fn("AdminStory.changesRole")(function* (name: string, target: string, role: "admin" | "owner" | "user") {
				story.tell(`${name} makes ${target} ${role === "admin" ? "an" : "a"} ${role}`);
				const admin = yield* adminOf(name);
				return yield* answer(Effect.as(admin["admin.users.changeRole"]({ role, userId: engine.userIds.get(target) ?? "missing" }), "changed"));
			}),
			createsNote: Effect.fn("AdminStory.createsNote")(function* (name: string, title: string) {
				story.tell(`${name} creates the note ${JSON.stringify(title)}`);
				const client = yield* notesHttp(engine.host.baseUrl, engine.cookies.get(name), engine.host.origin);
				return yield* client["notes.create"]({ title });
			}),
			jobQueues: Effect.fn("AdminStory.jobQueues")(function* (name: string) {
				story.tell(`${name} reads the job health page`);
				const admin = yield* adminOf(name);
				return yield* answer(Effect.map(admin["admin.jobs.health"](), ({ jobs }) => jobs.map((queue) => queue.name)));
			}),
			noteStatistics: Effect.fn("AdminStory.noteStatistics")(function* (name: string) {
				story.tell(`${name} reads the notes statistics`);
				const admin = yield* adminOf(name);
				return yield* answer(admin["admin.notes.statistics"]());
			}),
			owners: Effect.fn("AdminStory.owners")(function* (name: string) {
				story.tell(`${name} counts the owners on the users page`);
				const admin = yield* adminOf(name);
				return yield* answer(
					Effect.map(admin["admin.users.list"]({ limit: 20 }), ({ users }) =>
						countWords(users.filter(({ role }) => role === "owner").length, "owner"),
					),
				);
			}),
			recordedRoleChanges: () =>
				Effect.sync(() => {
					story.tell("read the role changes the app host logged");
					return engine.host.logs
						.filter(({ message }) => Array.isArray(message) && message.includes("User role changed"))
						.map(({ annotations }) => roleChange(engine, annotations));
				}),
			servesAppShell: (path: string) =>
				Effect.promise(async () => {
					const page = await fetch(new URL(path, engine.url)).then((response) => response.text());
					return page.includes("/src/client/main.tsx") ? "the app shell" : "another page";
				}),
			userPages: Effect.fn("AdminStory.userPages")(function* (name: string, limit: number) {
				story.tell(`${name} pages through the users ${limit} at a time`);
				const admin = yield* adminOf(name);
				const emails: string[] = [];
				let pages = 0;
				let cursor: string | undefined;
				do {
					const page = yield* admin["admin.users.list"](cursor === undefined ? { limit } : { cursor, limit });
					emails.push(...page.users.map(({ email }) => email));
					pages += 1;
					cursor = Option.getOrUndefined(page.next);
				} while (cursor !== undefined);
				return { emails: emails.sort((left, right) => left.localeCompare(right)), pages };
			}),
			users: Effect.fn("AdminStory.users")(function* (name: string) {
				story.tell(`${name} reads the users page`);
				const admin = yield* adminOf(name);
				return yield* answer(
					Effect.map(admin["admin.users.list"]({ limit: 20 }), ({ canChangeRoles, users }) => ({
						canChangeRoles,
						users: users.map(({ email, role }) => ({ email, role })).sort((left, right) => left.email.localeCompare(right.email)),
					})),
				);
			}),
			wordCountQueue: Effect.fn("AdminStory.wordCountQueue")(function* (name: string) {
				story.tell(`${name} reads the word-count queue counts`);
				const admin = yield* adminOf(name);
				return yield* answer(
					Effect.map(admin["admin.jobs.counts"]({ queue: "count-note-words" }), ({ queuedCount, totalCount }) => ({
						queued: queuedCount,
						total: totalCount,
					})),
				);
			}),
			workerCountsQueuedNotes: Effect.fn("AdminStory.workerCountsQueuedNotes")(function* () {
				story.tell("the word-count worker starts and counts every queued note");
				const database = yield* PostgresTestDatabase;
				const jobs = makePgBossTesting();
				const scope = yield* Scope.fork(yield* Scope.Scope);
				yield* Layer.buildWithScope(
					applicationWorker({
						databaseUrl: database.url,
						poolSizes: testPoolSizes,
						replacements: Layer.succeed(JobsClientFactory, jobs.clientFactory),
					}),
					scope,
				);
				yield* jobs.waitForIdle;
				yield* Scope.close(scope, Exit.void);
			}),
		};
	},
});

export function adminAccount(name: string, role = "user") {
	return adminHost.trait("accounts", `${name} is signed in as ${role === "admin" ? "an" : "a"} ${role}`, function* (engine) {
		const { headers, user } = yield* mintUser(engine.host, name, role);
		engine.cookies.set(name, headers.get("cookie") ?? "");
		engine.userIds.set(name, user.id);
	});
}

export function adminThroughDevelopmentServer() {
	return adminHost.trait("development", "admin pages and RPC reach the app through its Vite development server", function* (engine) {
		engine.url = (yield* developmentServer(engine.host.baseUrl)).url;
	});
}
