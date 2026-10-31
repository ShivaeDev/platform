import { Effect } from "effect";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { fakeGitHub } from "#test/sign-in-policy/github.ts";
import { accountRoleHost, type Person, type SeedRole } from "./accountRoleHost.ts";

export const accountRoles = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const github = yield* fakeGitHub(new Map([["1001", { id: "1001", login: "alice", member: true }]]));
		yield* routeOutbound({ "api.github.com": github.url, "github.com": github.url });
		return yield* accountRoleHost();
	},
	layer: postgres,
	name: "configured account roles",
	runIf: databaseUrl !== undefined,
	stages: ["accounts", "users"],
	verbs: (host, story) => ({
		boot: () => {
			story.tell("the server boots and applies its configured account role seed");
			return host.start().pipe(
				Effect.as("started"),
				Effect.catchTag("LastRoleAssigner", () => Effect.succeed("last role assigner")),
				Effect.catchTag("ConfigError", (error) => Effect.succeed(`invalid config: ${error.message}`)),
			);
		},
		observedStoredRoles: host.observedStoredRoles,
		observeUsers: () => {
			story.tell("the application observes stored user roles through its existing Reactivity service");
			return host.observeUsers();
		},
		removeAccounts: () => {
			story.tell("the operator removes every configured account");
			return Effect.sync(() => host.configure(""));
		},
		sessionRole: host.sessionRole,
		signIn: (person: Person) => {
			story.tell(`${person} signs in through the GitHub callback for the first time`);
			return host.signIn(person);
		},
	}),
});

export function listedAccounts(entries: string | undefined, role: SeedRole = "operator") {
	return accountRoles.trait("accounts", `the ${role} seed reads ${JSON.stringify(entries) ?? "an unset list"} from config`, (host) => {
		host.configure(entries, role);
	});
}

export function existingAccount(person: Person, role: SeedRole = "user") {
	return accountRoles.trait("users", `${person} already holds the stored ${role} role and a GitHub account`, (host) => host.mint(person, role));
}
