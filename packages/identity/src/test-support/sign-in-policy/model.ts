import { type Cause, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { ProviderAccountValue } from "#identity.ts";
import type { SignInPolicy } from "#server/better-auth/signInGate.ts";
import type { Revocation, SignInAnswer } from "#test/sign-in-policy/answers.ts";
import { type fakeGitHub, type GitHubAccount, ORGANIZATION } from "#test/sign-in-policy/fakeGitHub.ts";
import type { PolicyHost } from "#test/sign-in-policy/host.ts";
import type { policyProbe } from "#test/sign-in-policy/requestWork.ts";

export const people = { alice: "1001", bob: "1002", carol: "1003" } as const;
export type Person = keyof typeof people;

export const RECHECK_INTERVAL = "1 second";
export const UNLISTED_USERS = 120;
export const malformedLists = { "a provider without an account id": "github", "an empty list": "" } as const;
export type MalformedList = keyof typeof malformedLists;

export interface Engine {
	readonly accounts: Map<string, GitHubAccount>;
	readonly app: { sessionsOpen: boolean; providerAccounts?: boolean; readonly policy: Effect.Success<typeof policyProbe> };
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

export function membershipRule(account: ProviderAccountValue) {
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

export function entriesOf(listed: readonly Person[]) {
	return listed.map((person) => `github:${people[person]}`).join(",");
}

export function nameOf(email: string) {
	return email.slice(0, email.indexOf("@"));
}

export function host(engine: Engine) {
	if (engine.host.current === undefined) {
		throw new Error("The sign-in policy host has not started");
	}
	return engine.host.current;
}
