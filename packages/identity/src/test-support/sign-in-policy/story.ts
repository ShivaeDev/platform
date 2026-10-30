import { Cause, Clock, Effect, Exit, Result } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { TestClock } from "effect/testing";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { ProviderAccountValue } from "#identity.ts";
import { allowedAccounts } from "#server/better-auth/allowedAccounts.ts";
import type { SignInPolicy } from "#server/better-auth/signInGate.ts";
import { databaseUrl, postgres } from "#test/better-auth/postgres.ts";
import { type RequestAnswer, type Revocation, requestFailures, revocationOf, type SignInAnswer, signInRefusals } from "./answers.ts";
import { emailSignUp, gitHubSignIn } from "./flows.ts";
import { fakeGitHub, type GitHubAccount, ORGANIZATION } from "./github.ts";
import { type PolicyHost, policyHost } from "./host.ts";

const people = { alice: "1001", bob: "1002", carol: "1003" } as const;
export type Person = keyof typeof people;

const RECHECK_INTERVAL = "1 second";
const UNLISTED_USERS = 120;
const malformedLists = { "a provider without an account id": "github", "an empty list": "" } as const;
export type MalformedList = keyof typeof malformedLists;

interface Engine {
	readonly accounts: Map<string, GitHubAccount>;
	readonly app: { sessionsOpen: boolean };
	readonly cookies: Map<Person, string>;
	readonly env: Record<string, string>;
	readonly github: Effect.Success<ReturnType<typeof fakeGitHub>>;
	readonly host: { current?: PolicyHost };
	policy: SignInPolicy<Cause.UnknownError> | undefined;
	revocation?: Revocation;
	readonly signIns: Map<Person, SignInAnswer>;
	readonly signUps: Map<string, string>;
	startup?: string;
}

function membershipRule(account: ProviderAccountValue) {
	return account.providerId === "github"
		? Effect.tryPromise(async () => {
				const { status } = await fetch(`https://api.github.com/orgs/${ORGANIZATION}/members/${account.accountId}`);
				if (status !== HttpStatus.fromLiteral("NoContent") && status !== HttpStatus.fromLiteral("NotFound")) {
					throw new Error(`GitHub answered the membership check with HTTP ${status}`);
				}
				return status === HttpStatus.fromLiteral("NoContent");
			})
		: Effect.succeed(false);
}

function entriesOf(listed: readonly Person[]) {
	return listed.map((person) => `github:${people[person]}`).join(",");
}

function nameOf(email: string) {
	return email.slice(0, email.indexOf("@"));
}

function host(engine: Engine) {
	if (engine.host.current === undefined) {
		throw new Error("The sign-in policy host has not started");
	}
	return engine.host.current;
}

const signIn = Effect.fnUntraced(function* (engine: Engine, person: Person, device: string) {
	const result = yield* Effect.promise(() => gitHubSignIn(host(engine).baseUrl, people[person], device));
	if (result.signedIn) {
		engine.cookies.set(person, result.cookie);
	}
	const answer: SignInAnswer = result.signedIn ? "signed in" : (signInRefusals.get(result.error) ?? `failed: ${result.error ?? "no error"}`);
	engine.signIns.set(person, answer);
	return answer;
});

const signedInOn = Effect.fnUntraced(function* (engine: Engine, person: Person, device: string) {
	const answer = yield* signIn(engine, person, device);
	if (answer !== "signed in") {
		return yield* Effect.die(`${person} could not sign in on the ${device}: ${answer}`);
	}
});

export const signInPolicy = storyKit({
	after: {
		*policy(engine) {
			const database = yield* PostgresTestDatabase;
			engine.host.current = yield* policyHost(database.url, engine.env, engine.policy, engine.app);
		},
	},
	around: withIsolatedDatabase,
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
	verbs: (engine, story) => {
		engine.github.narrate(story.tell);
		return {
			corruptList: (kind: MalformedList) =>
				Effect.sync(() => {
					story.tell(`the operator sets AUTH_ALLOWED_ACCOUNTS to ${JSON.stringify(malformedLists[kind])}, ${kind}`);
					engine.env.AUTH_ALLOWED_ACCOUNTS = malformedLists[kind];
				}),
			leaveOrganization: (person: Person) =>
				Effect.sync(() => {
					story.tell(`${person} leaves the ${ORGANIZATION} organization on GitHub`);
					const account = engine.accounts.get(people[person]);
					if (account === undefined) {
						throw new Error(`No GitHub account for ${person}`);
					}
					account.member = false;
				}),
			recheckIntervalPasses: () => {
				story.tell(`the ${RECHECK_INTERVAL} recheck interval passes`);
				return TestClock.adjust(RECHECK_INTERVAL);
			},
			remove: (...removed: Person[]) =>
				Effect.sync(() => {
					story.tell(`the operator removes ${removed.join(" and ")} from AUTH_ALLOWED_ACCOUNTS`);
					const entries = new Set((engine.env.AUTH_ALLOWED_ACCOUNTS ?? "").split(","));
					for (const person of removed) {
						entries.delete(`github:${people[person]}`);
					}
					engine.env.AUTH_ALLOWED_ACCOUNTS = [...entries].join(",");
				}),
			request: (person: Person) =>
				Effect.gen(function* () {
					story.tell(`${person} makes an authenticated request over native RPC`);
					const result = yield* host(engine).whoami(engine.cookies.get(person) ?? "");
					if (Result.isSuccess(result)) {
						return "ok" satisfies RequestAnswer;
					}
					const tag = result.failure._tag;
					return requestFailures.get(tag) ?? (`failed: ${tag}` satisfies RequestAnswer);
				}),
			restart: () =>
				Effect.gen(function* () {
					story.tell("the application restarts with the current configuration");
					const database = yield* PostgresTestDatabase;
					const restarted = yield* Effect.exit(policyHost(database.url, engine.env, engine.policy, engine.app));
					if (Exit.isSuccess(restarted)) {
						engine.host.current = restarted.value;
						engine.startup = "started";
						return;
					}
					const error = Cause.findErrorOption(restarted.cause);
					engine.startup =
						error._tag === "Some" ? `refused to start: ${error.value.message.replaceAll(/\s+/gu, " ")}` : `crashed: ${Cause.pretty(restarted.cause)}`;
				}),
			revocation: () =>
				Effect.sync(() => {
					if (engine.revocation === undefined) {
						throw new Error("No revocation has run");
					}
					return engine.revocation;
				}),
			revoke: () =>
				Effect.gen(function* () {
					story.tell("the operator revokes the sessions the current policy no longer admits");
					engine.revocation = revocationOf(yield* Effect.exit(host(engine).revokeUnadmitted));
				}),
			sessionHolders: () => {
				story.tell("read the users who still hold a stored session");
				return Effect.promise(async () => (await host(engine).sessionHolders()).map(nameOf));
			},
			signIn: (person: Person) => {
				story.tell(`${person} signs in with GitHub account ${people[person]}`);
				return signIn(engine, person, "browser");
			},
			signInAnswer: (person: Person) =>
				Effect.sync(() => {
					const answer = engine.signIns.get(person);
					if (answer === undefined) {
						throw new Error(`${person} has not tried to sign in`);
					}
					return answer;
				}),
			signUpAnswer: (person: string) =>
				Effect.sync(() => {
					const answer = engine.signUps.get(person);
					if (answer === undefined) {
						throw new Error(`${person} has not tried to sign up`);
					}
					return answer;
				}),
			signUpWithEmail: (person: string) =>
				Effect.promise(async () => {
					story.tell(`${person} signs up with an email and password`);
					const { code, ok } = await emailSignUp(host(engine).baseUrl, `${person}@example.test`);
					if (ok) {
						engine.signUps.set(person, "signed up");
					} else {
						engine.signUps.set(person, code === "sign_in_refused" ? "refused" : `failed: ${code ?? "no code"}`);
					}
				}),
			startup: () =>
				Effect.sync(() => {
					if (engine.startup === undefined) {
						throw new Error("The application has not restarted");
					}
					return engine.startup;
				}),
			storedSessions: (person: Person | "dana") => {
				story.tell(`read the devices of ${person}'s stored sessions`);
				return Effect.promise(() => host(engine).sessionDevices(person === "dana" ? "dana@example.test" : `${person}@github.test`));
			},
			storedUsers: () => {
				story.tell("read the stored users");
				return Effect.promise(async () => (await host(engine).storedUsers()).map(nameOf));
			},
		};
	},
});

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
		engine.policy = { ...engine.policy, recheckInterval: RECHECK_INTERVAL, rule: membershipRule };
	},
);

export function signedIn(person: Person) {
	return signInPolicy.trait("sessions", `${person} has signed in with GitHub in a browser`, (engine) => signedInOn(engine, person, "browser"));
}

export function signedInOnTwoDevices(person: Person) {
	return signInPolicy.trait("sessions", `${person} has signed in with GitHub on a laptop and a phone`, function* (engine) {
		yield* signedInOn(engine, person, "laptop");
		yield* signedInOn(engine, person, "phone");
	});
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
