import { type Cause, Clock, Duration, Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { ProviderAccountValue } from "#rpc/identity.ts";
import { allowedAccounts } from "#server/better-auth/allowedAccounts.ts";
import type { SignInPolicy } from "#server/better-auth/signInGate.ts";
import { databaseUrl, postgres } from "#test/better-auth/postgres.ts";
import { emailSignUp, gitHubSignIn } from "./flows.ts";
import { fakeGitHub, type GitHubAccount, ORGANIZATION } from "./github.ts";
import { type PolicyHost, policyHost } from "./host.ts";

const people = { alice: "1001", bob: "1002", carol: "1003" } as const;
type Person = keyof typeof people;

interface Engine {
	readonly accounts: Map<string, GitHubAccount>;
	readonly app: { sessionsOpen: boolean };
	readonly cookies: Map<Person, string>;
	readonly env: Record<string, string>;
	readonly github: Effect.Success<ReturnType<typeof fakeGitHub>>;
	readonly host: { current?: PolicyHost };
	policy: SignInPolicy<Cause.UnknownError> | undefined;
}

function membershipRule(account: ProviderAccountValue) {
	return account.providerId === "github"
		? Effect.tryPromise(async () => {
				const { status } = await fetch(`https://api.github.com/orgs/${ORGANIZATION}/members/${account.accountId}`);
				if (status !== 204 && status !== 404) {
					throw new Error(`GitHub answered the membership check with HTTP ${status}`);
				}
				return status === 204;
			})
		: Effect.succeed(false);
}

export const signInPolicy = storyKit({
	after: {
		*policy(engine) {
			const database = yield* PostgresTestDatabase;
			engine.host.current = yield* policyHost(database.url, engine.env, engine.policy, engine.app);
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const accounts = new Map<string, GitHubAccount>(Object.entries(people).map(([login, id]) => [id, { id, login, member: true }]));
		const github = yield* fakeGitHub(accounts);
		yield* routeOutbound({ "api.github.com": github.url, "github.com": github.url });
		const engine: Engine = {
			accounts,
			app: { sessionsOpen: true },
			cookies: new Map(),
			env: { "AUTH_RATE_LIMIT_ENABLED": "false" },
			github,
			host: {},
			policy: undefined,
		};
		return engine;
	},
	inspect: (engine) => ({ allowed: engine.env.AUTH_ALLOWED_ACCOUNTS, signedIn: [...engine.cookies.keys()] }),
	layer: postgres,
	name: "sign-in policy",
	runIf: databaseUrl !== undefined,
	stages: ["policy"],
	verbs: (engine, story) => {
		engine.github.narrate(story.tell);
		function host() {
			if (engine.host.current === undefined) {
				throw new Error("The sign-in policy host has not started");
			}
			return engine.host.current;
		}
		return {
			allowOnly: (...entries: string[]) =>
				Effect.sync(() => {
					story.tell(`the operator sets AUTH_ALLOWED_ACCOUNTS to ${entries.join(",")}`);
					engine.env.AUTH_ALLOWED_ACCOUNTS = entries.join(",");
				}),
			closeSessions: () =>
				Effect.sync(() => {
					story.tell("the application's own session hook stops admitting new sessions");
					engine.app.sessionsOpen = false;
				}),
			leaveOrganization: (person: Person) =>
				Effect.sync(() => {
					story.tell(`${person} leaves the ${ORGANIZATION} organization on GitHub`);
					const account = engine.accounts.get(people[person]);
					if (account !== undefined) {
						account.member = false;
					}
				}),
			membershipChecks: () => engine.github.requests.filter(({ path }) => path.startsWith(`/orgs/${ORGANIZATION}/`)).length,
			membershipOutage: () => {
				story.tell("GitHub stops answering organization membership checks");
				return engine.github.scriptFault("membership", { kind: "drop" }, { repeat: true });
			},
			restart: () =>
				Effect.gen(function* () {
					story.tell("the application restarts with the current configuration");
					const database = yield* PostgresTestDatabase;
					const restarted = yield* Effect.exit(policyHost(database.url, engine.env, engine.policy, engine.app));
					if (restarted._tag === "Success") {
						engine.host.current = restarted.value;
					}
					return restarted;
				}),
			revokeUnadmitted: () => {
				story.tell("the operator revokes the sessions the current policy no longer admits");
				return host().revokeUnadmitted;
			},
			seedGitHubUsers: (count: number) => {
				story.tell(`${count} more GitHub users with one session each are already stored`);
				return Effect.flatMap(Clock.currentTimeMillis, (now) => Effect.promise(() => host().seedGitHubUsers(count, new Date(now))));
			},
			sessionHolders: () => {
				story.tell("read the users that still hold a session");
				return Effect.promise(() => host().sessionHolders());
			},
			signIn: (person: Person) =>
				Effect.promise(async () => {
					story.tell(`${person} signs in with GitHub account ${people[person]}`);
					const result = await gitHubSignIn(host().baseUrl, people[person]);
					if (!result.signedIn) {
						return result;
					}
					engine.cookies.set(person, result.cookie);
					return { signedIn: true } as const;
				}),
			signUpWithEmail: (email: string) => {
				story.tell(`${email} signs up with an email and password`);
				return Effect.promise(() => emailSignUp(host().baseUrl, email));
			},
			storedSessions: () => {
				story.tell("read the stored sessions of every user");
				return Effect.promise(() => host().storedSessions());
			},
			storedUsers: () => {
				story.tell("read the stored users");
				return Effect.promise(async () => Object.keys(await host().storedSessions()));
			},
			waitForRecheck: (interval: Duration.Input) => {
				story.tell(`the recheck interval of ${Duration.format(Duration.fromInputUnsafe(interval))} passes`);
				return Effect.sleep(Duration.sum(Duration.fromInputUnsafe(interval), Duration.millis(50)));
			},
			whoami: (person: Person) => {
				story.tell(`${person} asks who they are over native RPC`);
				return host().whoami(engine.cookies.get(person) ?? "");
			},
		};
	},
});

export function allowedList(...entries: string[]) {
	return signInPolicy.trait("policy", `AUTH_ALLOWED_ACCOUNTS lists ${entries.join(",")}`, (engine) => {
		engine.env.AUTH_ALLOWED_ACCOUNTS = entries.join(",");
		engine.policy = { ...engine.policy, accounts: allowedAccounts };
	});
}

export function organizationRule(recheckInterval: Duration.Input) {
	return signInPolicy.trait("policy", `the application admits members of ${ORGANIZATION}, rechecked every ${String(recheckInterval)}`, (engine) => {
		engine.policy = { ...engine.policy, recheckInterval, rule: membershipRule };
	});
}
