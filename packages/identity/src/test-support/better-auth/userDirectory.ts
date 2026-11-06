import { Effect, Queue, Result } from "effect";
import type { Observation } from "@shivaedev/changes/observe.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { ChangeObserver, transact } from "@shivaedev/sql/transact.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AuthTableOptions } from "#server/better-auth/adapters/tables.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { directoryHost } from "./directoryHost.ts";
import { mappedTables, pluginMappedTables } from "./pluginMappedTables.ts";

function recordPublished(published: unknown[]) {
	return (event: Observation<unknown>) =>
		Effect.sync(() => {
			if (event._tag === "Published") {
				published.push(...event.changes);
			}
		});
}

function directoryKit(mapping: AuthTableOptions = {}, standalone = false) {
	return storyKit({
		around: withIdentityDatabase,
		clock: storyClock,
		create: () => directoryHost(mapping, standalone),
		layer: postgres,
		name: "identity user directory",
		runIf: databaseUrl !== undefined,
		stages: ["accounts"],
		verbs: (host, story) => ({
			assignRole: (id: string, role: string) => {
				story.tell(`the directory assigns ${role} to ${id}`);
				return host.directory.assignRole(id, role).pipe(
					Effect.map((changed) => (changed ? "assigned" : "unchanged")),
					Effect.catchTag("LastRoleAssigner", (error) => Effect.succeed(error)),
					Effect.catchTag("NotFound", () => Effect.succeed("user not found")),
					Effect.catchTag("AuthUnavailable", () => Effect.succeed("auth unavailable")),
				);
			},
			list: host.directory.list,
			names: host.directory.names,
			nextChange: <A, E>(queue: Queue.Dequeue<A, E>) => Queue.take(queue),
			role: (id: string) =>
				host.directory.role(id).pipe(
					Effect.catchTag("NotFound", () => Effect.succeed("user not found")),
					Effect.catchTag("AuthUnavailable", () => Effect.succeed("auth unavailable")),
				),
			rollbackRole: (id: string, role: string) => {
				story.tell(`the application rolls back its transaction assigning ${role} to ${id}`);
				const published: unknown[] = [];
				return host.directory.assignRole(id, role).pipe(
					Effect.andThen(Effect.fail("cancelled assignment")),
					transact({ onSqlError: () => new AuthUnavailable({ message: "Could not assign role" }) }),
					Effect.provideService(ChangeObserver, recordPublished(published)),
					Effect.result,
					Effect.map((result) => ({ published, reason: Result.isFailure(result) ? result.failure : undefined })),
				);
			},
			tryList: (input: Parameters<typeof host.directory.list>[0]) =>
				host.directory.list(input).pipe(Effect.catchTag("AuthUnavailable", () => Effect.succeed("auth unavailable"))),
			watchRole: host.watchRole,
			watchUsers: host.watchUsers,
		}),
	});
}

export const userDirectory = directoryKit();
export const standaloneUserDirectory = directoryKit({}, true);
export const mappedUserDirectory = directoryKit(mappedTables);
export const pluginMappedUserDirectory = directoryKit(pluginMappedTables);

export const directoryAccounts = userDirectory.trait("accounts", "alice assigns roles; bob and carol are members", function* (host) {
	yield* host.mint("carol", "Carol", "member");
	yield* host.mint("alice", "Alice", "assigner");
	yield* host.mint("bob", "Bob", "member");
});

export const undeclaredAccount = userDirectory.trait("accounts", "bob has a role the application no longer declares", (host) =>
	host.mint("bob", "Bob", "retired").pipe(Effect.asVoid),
);
