import { Clock, DateTime, Effect } from "effect";
import { TestClock } from "effect/testing";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { allowedAccounts } from "#server/better-auth/allowedAccounts.ts";
import { fakeGitHub, type GitHubAccount, ORGANIZATION } from "./github.ts";
import { policyHost } from "./host.ts";
import { type Engine, entriesOf, host, membershipRule, type Person, people, RECHECK_INTERVAL, UNLISTED_USERS } from "./model.ts";
import { policyProbe } from "./requestWork.ts";
import { policyVerbs } from "./verbs.ts";

export const signInPolicy = storyKit({
	after: {
		*policy(engine) {
			engine.host.current = yield* policyHost(engine.env, engine.policy, engine.app);
		},
	},
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const accounts = new Map<string, GitHubAccount>(Object.entries(people).map(([login, id]) => [id, { id, login, member: true }]));
		const github = yield* fakeGitHub(accounts);
		yield* routeOutbound({ "api.github.com": github.url, "github.com": github.url });
		const engine: Engine = {
			accounts,
			app: { policy: yield* policyProbe, sessionsOpen: true },
			cookies: new Map(),
			env: { "AUTH_RATE_LIMIT_ENABLED": "false" },
			github,
			host: {},
			policy: undefined,
			signIns: new Map(),
			signUps: new Map(),
		};
		return engine;
	},
	inspect: (engine) => ({ allowed: engine.env.AUTH_ALLOWED_ACCOUNTS, signedIn: [...engine.cookies.keys()] }),
	layer: postgres,
	name: "sign-in policy",
	runIf: databaseUrl !== undefined,
	stages: ["policy", "sessions", "conditions"],
	verbs: (engine, story) => policyVerbs(engine, story.tell),
});

export const withProviderAccounts = signInPolicy.trait("policy", "the app supplies Better Auth's provider-account lookup", (engine) => {
	engine.app.providerAccounts = true;
});

export function mintedSession(person: Person) {
	return signInPolicy.trait("sessions", `${person} starts with a minted session and linked GitHub account`, function* (engine) {
		const session = yield* host(engine).mintSession(person, people[person]);
		engine.cookies.set(person, session.headers.get("cookie") ?? "");
	});
}

export function allowed(...listed: Person[]) {
	return signInPolicy.trait("policy", `AUTH_ALLOWED_ACCOUNTS lists ${listed.join(" and ")}'s GitHub accounts`, (engine) => {
		engine.env.AUTH_ALLOWED_ACCOUNTS = entriesOf(listed);
		engine.policy = { ...engine.policy, accounts: allowedAccounts };
	});
}

export const organizationRule = signInPolicy.trait(
	"policy",
	`the application admits members of ${ORGANIZATION}, rechecked every ${RECHECK_INTERVAL}`,
	(engine) => {
		engine.policy = {
			...engine.policy,
			recheckInterval: RECHECK_INTERVAL,
			rule: (account) => engine.app.policy.check(membershipRule(account)),
		};
	},
);

export function admittedSession(person: Person, devices: readonly string[] = ["browser"]) {
	return signInPolicy.trait(
		"sessions",
		`${person} starts with minted sessions on ${devices.join(" and ")} and an admitted request`,
		function* (engine) {
			const session = yield* host(engine).mintSession(person, people[person], devices);
			const cookie = session.headers.get("cookie") ?? "";
			engine.cookies.set(person, cookie);
			yield* host(engine).resolveSession(cookie);
		},
	);
}

export const moreThanOnePageOfUnlistedUsers = signInPolicy.trait(
	"sessions",
	`${UNLISTED_USERS} unlisted GitHub users already hold a session each, more than the 100 users a revocation reads per page`,
	(engine) =>
		Effect.flatMap(TestClock.withLive(Clock.currentTimeMillis), (now) =>
			Effect.promise(() => host(engine).seedGitHubUsers(UNLISTED_USERS, new Date(now))),
		),
);

export const membershipChecksDown = signInPolicy.trait("conditions", "GitHub stops answering organization membership checks", (engine) =>
	engine.github.scriptFault("membership", { kind: "drop" }, { repeat: true }),
);

export const applicationRefusesNewSessions = signInPolicy.trait(
	"conditions",
	"the application's own session hook stops admitting new sessions",
	(engine) => {
		engine.app.sessionsOpen = false;
	},
);

export const policyWaits = signInPolicy.trait("conditions", "the membership check waits for its provider", (engine) => {
	engine.app.policy.waiting = true;
});
