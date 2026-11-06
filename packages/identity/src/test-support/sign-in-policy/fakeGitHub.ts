import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeOauthProvider } from "@shivaedev/test-kits/identity/oauth.ts";

export interface GitHubAccount {
	readonly id: string;
	readonly login: string;
	member: boolean;
}

export const ORGANIZATION = "story-org";

export const fakeGitHub = Effect.fnUntraced(function* (accounts: ReadonlyMap<string, GitHubAccount>) {
	const { server } = yield* fakeOauthProvider({
		profile: ({ headers }) => {
			const account = accounts.get(String(headers["x-github-account"]));
			if (account === undefined) {
				throw new Error("No GitHub account selected");
			}
			return { email: `${account.login}@github.test`, name: account.login, sub: account.id };
		},
		routes: {
			membership: {
				path: `/orgs/${ORGANIZATION}/members/:id`,
				reply: ({ params }) => ({
					status: accounts.get(params.id ?? "")?.member === true ? HttpStatus.fromLiteral("NoContent") : HttpStatus.fromLiteral("NotFound"),
				}),
			},
		},
	});
	return server;
});
