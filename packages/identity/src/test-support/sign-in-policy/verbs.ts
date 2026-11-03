import { Effect, Result } from "effect";
import { TestClock } from "effect/testing";
import { accountVerbs } from "./accountVerbs.ts";
import { type RequestAnswer, requestFailures, revocationOf, type SignInAnswer, signInRefusals } from "./answers.ts";
import { configurationVerbs } from "./configurationVerbs.ts";
import { emailSignUp, gitHubSignIn } from "./flows.ts";
import { ORGANIZATION } from "./github.ts";
import { policyHost } from "./host.ts";
import { type Engine, host, type MalformedList, malformedLists, nameOf, type Person, people, RECHECK_INTERVAL } from "./model.ts";
import { requestWork } from "./requestWork.ts";

const signIn = Effect.fnUntraced(function* (engine: Engine, person: Person, device: string) {
	const result = yield* Effect.promise(() => gitHubSignIn(host(engine).baseUrl, people[person], device));
	if (result.signedIn) {
		engine.cookies.set(person, result.cookie);
	}
	const answer: SignInAnswer = result.signedIn ? "signed in" : (signInRefusals.get(result.error) ?? `failed: ${result.error ?? "no error"}`);
	engine.signIns.set(person, answer);
	return answer;
});

export function policyVerbs(engine: Engine, tell: (line: string) => void) {
	engine.github.narrate(tell);
	return {
		...configurationVerbs(engine, () => policyHost(engine.env, engine.policy, engine.app), tell),
		...requestWork(engine.app.policy, engine.cookies, () => host(engine), tell),
		...accountVerbs(() => host(engine), engine.cookies, tell),
		cancelledSignInPolicy: () => engine.app.policy.waitForInterruption.pipe(Effect.as("interrupted")),
		cancelSignIn: (person: Person) => {
			tell(`${person} cancels a GitHub sign-in while its policy check is waiting`);
			return engine.app.policy.cancel(Effect.tryPromise((signal) => gitHubSignIn(host(engine).baseUrl, people[person], "browser", signal)));
		},
		corruptList: (kind: MalformedList) =>
			Effect.sync(() => {
				tell(`the operator sets AUTH_ALLOWED_ACCOUNTS to ${JSON.stringify(malformedLists[kind])}, ${kind}`);
				engine.env.AUTH_ALLOWED_ACCOUNTS = malformedLists[kind];
			}),
		leaveOrganization: (person: Person) =>
			Effect.sync(() => {
				tell(`${person} leaves the ${ORGANIZATION} organization on GitHub`);
				const account = engine.accounts.get(people[person]);
				if (account === undefined) {
					throw new Error(`No GitHub account for ${person}`);
				}
				account.member = false;
			}),
		recheckIntervalPasses: () => {
			tell(`the ${RECHECK_INTERVAL} recheck interval passes`);
			return TestClock.adjust(RECHECK_INTERVAL);
		},
		remove: (...removed: Person[]) =>
			Effect.sync(() => {
				tell(`the operator removes ${removed.join(" and ")} from AUTH_ALLOWED_ACCOUNTS`);
				const entries = new Set((engine.env.AUTH_ALLOWED_ACCOUNTS ?? "").split(","));
				for (const person of removed) {
					entries.delete(`github:${people[person]}`);
				}
				engine.env.AUTH_ALLOWED_ACCOUNTS = [...entries].join(",");
			}),
		request: (person: Person) =>
			Effect.gen(function* () {
				tell(`${person} makes an authenticated request over native RPC`);
				const result = yield* host(engine).whoami(engine.cookies.get(person) ?? "");
				if (Result.isSuccess(result)) {
					return "ok" satisfies RequestAnswer;
				}
				const tag = result.failure._tag;
				return requestFailures.get(tag) ?? (`failed: ${tag}` satisfies RequestAnswer);
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
				tell("the operator revokes the sessions the current policy no longer admits");
				engine.revocation = revocationOf(yield* Effect.exit(host(engine).revokeUnadmitted));
			}),
		sessionHolders: () => {
			tell("read the users who still hold a stored session");
			return Effect.promise(async () => (await host(engine).sessionHolders()).map(nameOf));
		},
		signIn: (person: Person) => {
			tell(`${person} signs in with GitHub account ${people[person]}`);
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
				tell(`${person} signs up with an email and password`);
				const { code, ok } = await emailSignUp(host(engine).baseUrl, `${person}@example.test`);
				if (ok) {
					engine.signUps.set(person, "signed up");
				} else {
					engine.signUps.set(person, code === "sign_in_refused" ? "refused" : `failed: ${code ?? "no code"}`);
				}
			}),
		storedSessions: (person: Person | "dana") => {
			tell(`read the devices of ${person}'s stored sessions`);
			return Effect.promise(() => host(engine).sessionDevices(person === "dana" ? "dana@example.test" : `${person}@github.test`));
		},
		storedUsers: () => {
			tell("read the stored users");
			return Effect.promise(async () => (await host(engine).storedUsers()).map(nameOf));
		},
	};
}
