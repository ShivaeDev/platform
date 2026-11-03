import { Effect, Predicate } from "effect";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import type { Caller } from "./callers.ts";
import { callers } from "./callers.ts";
import type { Host } from "./host.ts";
import { type Account, authRequest, client } from "./requests.ts";

export function requestVerbs(host: Host, accounts: Map<string, Account>, tell: (line: string) => void) {
	const { account, headersOf, nameOf, callerWords } = callers(accounts);
	return {
		profile: (caller: Caller, owner: string) =>
			Effect.gen(function* () {
				tell(`a client with ${callerWords(caller)} reads ${owner}'s protected profile through RPC over HTTP`);
				const rpc = yield* client(host, headersOf(caller));
				const answer = yield* answered(rpc("native.profile", { owner: account(owner).user.id }));
				return Predicate.hasProperty(answer, "id") ? `${nameOf(answer.id) ?? "an unknown user"}'s profile` : answer;
			}),
		providerAccounts: (caller: Caller) =>
			Effect.gen(function* () {
				tell(`a client with ${callerWords(caller)} reads linked provider accounts through RPC`);
				const rpc = yield* client(host, headersOf(caller));
				return yield* answered(rpc("native.accounts", undefined));
			}),
		sessionTokens: (caller: Caller) =>
			Effect.gen(function* () {
				const response = yield* authRequest(host, "get-session", headersOf(caller));
				const body: unknown = yield* Effect.promise(() => response.json());
				const session = Predicate.hasProperty(body, "session") ? body.session : undefined;
				return {
					bearerCredential: response.headers.get("set-auth-token") === null ? "none" : "issued",
					sessionToken: Predicate.hasProperty(session, "token") ? "returned" : "none",
				};
			}),
		sessionUser: (caller: Caller) =>
			Effect.gen(function* () {
				tell(`a client with ${callerWords(caller)} reads the session through the mounted auth route`);
				const response = yield* authRequest(host, "get-session", headersOf(caller));
				const body: unknown = yield* Effect.promise(() => response.json());
				return Predicate.hasProperty(body, "user") && Predicate.hasProperty(body.user, "id")
					? (nameOf(body.user.id) ?? "an unknown user")
					: "no session";
			}),
	};
}
