import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { DateTime, Effect, Option } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { makePgBossTesting, testRetryPolicy } from "@shivaedev/test-kits/jobs/testing.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { foundation } from "#admin/foundation.ts";
import { answer } from "#test-support/answers.ts";
import { startHost } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";
import { sessionPermissions } from "./session.ts";

export const foundationAdmin = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const host = yield* startHost({ jobsTesting: makePgBossTesting({ retryPolicy: testRetryPolicy }) });
		return { cookies: new Map<string, string>(), host, workerTesting: makePgBossTesting({ retryPolicy: testRetryPolicy }) };
	},
	inspect: ({ host }) => ({ baseUrl: host.baseUrl }),
	layer: postgres,
	name: "foundation admin",
	runIf: configured,
	stages: ["accounts", "worker"],
	verbs: (engine, story) => {
		const adminOf = Effect.fn("FoundationAdmin.adminOf")(function* (name: string) {
			return yield* makeClient(foundation.UsersPage.contract, {
				group: foundation.admin.group,
				headers: { cookie: engine.cookies.get(name) ?? "", origin: engine.host.origin },
				url: `${engine.host.baseUrl}/rpc`,
				webSocketConstructor: layerWebSocketConstructorWS,
			}).client;
		});
		return {
			failedJobs: Effect.fn("FoundationAdmin.failedJobs")(function* (name: string, queue: string) {
				story.tell(`${name} reads failed jobs in ${queue}`);
				const admin = yield* adminOf(name);
				return yield* answer(Effect.map(admin["admin.jobs.failed"]({ limit: 20, queue }), ({ jobs }) => jobs));
			}),
			jobDetail: Effect.fn("FoundationAdmin.jobDetail")(function* (name: string, queue: string, id: string) {
				story.tell(`${name} inspects ${id} in ${queue}`);
				const admin = yield* adminOf(name);
				return yield* answer(Effect.map(admin["admin.jobs.job"]({ id, queue }), Option.getOrNull));
			}),
			jobHealth: Effect.fn("FoundationAdmin.jobHealth")(function* (name: string) {
				story.tell(`${name} reads the job health page`);
				const admin = yield* adminOf(name);
				return yield* answer(
					Effect.map(admin["admin.jobs.health"](), ({ activeTotal, failedTotal }) => ({ active: activeTotal, failed: failedTotal })),
				);
			}),
			jobQueues: Effect.fn("FoundationAdmin.jobQueues")(function* (name: string) {
				story.tell(`${name} reads the Jobs inventory`);
				const admin = yield* adminOf(name);
				return yield* answer(Effect.map(admin["admin.jobs.health"](), ({ jobs }) => jobs.map(({ name: queue }) => queue)));
			}),
			permissions: Effect.fn("FoundationAdmin.permissions")(function* (name: string) {
				story.tell(`${name} reads her session's permissions`);
				return yield* sessionPermissions(engine.host.baseUrl, engine.cookies.get(name) ?? "");
			}),
			requestsPasswordReset: (name: string) =>
				Effect.promise(async () => {
					story.tell(`${name} requests a password reset email`);
					const response = await fetch(`${engine.host.baseUrl}/api/auth/request-password-reset`, {
						body: JSON.stringify({ email: `${name}@app.test` }),
						headers: { "content-type": "application/json", origin: engine.host.origin },
						method: "POST",
					});
					await response.text();
					return response.status;
				}),
			users: Effect.fn("FoundationAdmin.users")(function* (name: string) {
				story.tell(`${name} reads the users page`);
				const admin = yield* adminOf(name);
				return yield* answer(Effect.map(admin["admin.users.list"]({ limit: 20 }), ({ users }) => users.map(({ email }) => email)));
			}),
			workersFinish: () => engine.workerTesting.waitForIdle,
		};
	},
});

export function foundationAccount(name: string, role = "user") {
	return foundationAdmin.trait("accounts", `${name} is signed in as ${role === "user" ? "a" : "an"} ${role}`, function* (engine) {
		const { headers } = yield* mintUser(engine.host, name, role);
		engine.cookies.set(name, headers.get("cookie") ?? "");
	});
}
