import { Effect, Option } from "effect";
import { answered } from "@shivaedev/test/answers.ts";
import type { PolicyHost } from "./host.ts";
import type { Person } from "./story.ts";

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
