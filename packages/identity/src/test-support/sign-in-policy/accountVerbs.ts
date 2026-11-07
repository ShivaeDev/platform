import { Effect, Option } from "effect";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import type { PolicyHost } from "#test/sign-in-policy/host.ts";
import type { Person } from "#test/sign-in-policy/model.ts";

export function accountVerbs(host: () => PolicyHost, cookies: ReadonlyMap<Person, string>, tell: (line: string) => void) {
	return {
		accountLookups: () => Effect.sync(host().accountLookups),
		providerAccounts: (person: Person) => {
			tell(`${person} reads provider account IDs through native RPC`);
			return answered(host().providerAccounts(cookies.get(person) ?? ""));
		},
		sessionFields: (person: Person) =>
			Effect.map(
				host().resolveSession(cookies.get(person) ?? ""),
				Option.match({
					onNone: () => "signed out",
					onSome: (session) => Object.keys(session.user).sort((left, right) => left.localeCompare(right)),
				}),
			),
	};
}
