import { Deferred, Effect, Fiber, Predicate } from "effect";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { callers } from "#test/native-sessions/callers.ts";
import type { Host } from "#test/native-sessions/host.ts";
import { type Account, authRequest } from "#test/native-sessions/requests.ts";
import { nativeShell } from "#test/native-sessions/shell.ts";
import { CURRENT_PASSWORD } from "#test/passwords.ts";

export function shellVerbs(host: Host, accounts: ReadonlyMap<string, Account>, tell: (line: string) => void) {
	const { account, nameOf } = callers(accounts);
	const shell = nativeShell(host);
	let held: { readonly check: Fiber.Fiber<string>; readonly release: Deferred.Deferred<void> } | undefined;
	function sessionName(body: unknown) {
		return Predicate.hasProperty(body, "user") && Predicate.hasProperty(body.user, "id") ? (nameOf(body.user.id) ?? "an unknown user") : "no session";
	}
	const checkSession = Effect.promise(() => shell.auth.getSession()).pipe(
		Effect.flatMap(({ data, error }) =>
			error === null ? Effect.succeed(sessionName(data)) : Effect.die(`The session check answered ${error.status}`),
		),
	);
	return {
		deviceLocale: () => Effect.sync(() => new Intl.DateTimeFormat().resolvedOptions().locale),
		heldCheckAnswers: () => {
			tell("the held session check answers");
			return held === undefined
				? Effect.die("No session check is held")
				: Deferred.succeed(held.release, undefined).pipe(Effect.andThen(Fiber.join(held.check)));
		},
		shellChecksSession: () => {
			tell("the shell checks its session through its auth client");
			return checkSession;
		},
		shellCredentialsModes: () => Effect.sync(() => [...shell.modes]),
		shellPreflight: (path: string) =>
			Effect.sync(() => {
				const preflight = shell.preflights.findLast((sent) => sent.path === path);
				return preflight === undefined ? "no preflight" : `${preflight.granted ? "granted" : "refused"} for ${preflight.requested.join(", ")}`;
			}),
		shellReadsProfileOverSocket: (owner: string) =>
			Effect.gen(function* () {
				tell(`the shell connects a new client and reads ${owner}'s profile over the socket`);
				const answer = yield* answered(Effect.scoped(shell.readOverSocket(account(owner).user.id)));
				return Predicate.hasProperty(answer, "id") ? `${nameOf(answer.id) ?? "an unknown user"}'s profile` : answer;
			}),
		shellSendsHeldSessionCheck: () =>
			Effect.gen(function* () {
				tell("the shell sends a session check whose answer the network holds");
				const hold = { arrived: yield* Deferred.make<void>(), release: yield* Deferred.make<void>() };
				shell.network.hold = hold;
				held = { check: yield* Effect.forkScoped(checkSession), release: hold.release };
				yield* Deferred.await(hold.arrived);
			}),
		shellSignsIn: (name: string) => {
			tell(`${name} signs in through the shell's auth client`);
			return Effect.promise(() => shell.auth.signIn.email({ email: `${name}@example.test`, password: CURRENT_PASSWORD })).pipe(
				Effect.flatMap(({ error }) => (error === null ? Effect.void : Effect.die(`Sign-in answered ${error.status}`))),
			);
		},
		shellSignsOut: () => {
			tell("the shell signs out through its auth client");
			return Effect.promise(() => shell.auth.signOut()).pipe(
				Effect.flatMap(({ error }) => (error === null ? Effect.void : Effect.die(`Sign-out answered ${error.status}`))),
			);
		},
		storedCredentialSession: () =>
			Effect.suspend(() => {
				const stored = shell.credential.stored.value;
				if (stored === null) {
					return Effect.succeed("no credential");
				}
				return authRequest(host, "get-session", { authorization: `Bearer ${stored}` }).pipe(
					Effect.flatMap((response) => Effect.promise(() => response.json())),
					Effect.map(sessionName),
				);
			}),
		storedPreferences: (name: string) => host.preferences.get(account(name).user.id),
	};
}
