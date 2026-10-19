import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";

export interface GitHubAccount {
	readonly id: string;
	readonly login: string;
	member: boolean;
}

export const ORGANIZATION = "story-org";

function accountOf(accounts: ReadonlyMap<string, GitHubAccount>, authorization: string | undefined) {
	const id = authorization?.replace(/^Bearer story-token-/iu, "");
	return id === undefined ? undefined : accounts.get(id);
}

export function fakeGitHub(accounts: ReadonlyMap<string, GitHubAccount>) {
	return fakeHttpService({
		routes: {
			authorize: {
				path: "/login/oauth/authorize",
				reply: ({ headers, query }) => {
					const callback = new URL(query.get("redirect_uri") ?? "");
					callback.searchParams.set("state", query.get("state") ?? "");
					callback.searchParams.set("code", `story-code-${String(headers["x-github-account"])}`);
					return { headers: { location: callback.href }, status: 302 };
				},
			},
			emails: {
				path: "/user/emails",
				reply: ({ headers }) => {
					const account = accountOf(accounts, headers.authorization);
					return account === undefined
						? { body: { message: "Bad credentials" }, status: 401 }
						: { body: [{ email: `${account.login}@github.test`, primary: true, verified: true }] };
				},
			},
			membership: {
				path: `/orgs/${ORGANIZATION}/members/:id`,
				reply: ({ params }) => ({ status: accounts.get(params.id ?? "")?.member === true ? 204 : 404 }),
			},
			token: {
				method: "POST",
				path: "/login/oauth/access_token",
				reply: ({ body }) => {
					const code = new URLSearchParams(body.toString()).get("code") ?? "";
					return { body: { "access_token": code.replace("story-code-", "story-token-"), scope: "read:user,user:email", "token_type": "bearer" } };
				},
			},
			user: {
				path: "/user",
				reply: ({ headers }) => {
					const account = accountOf(accounts, headers.authorization);
					return account === undefined
						? { body: { message: "Bad credentials" }, status: 401 }
						: { body: { "avatar_url": null, email: null, id: Number(account.id), login: account.login, name: account.login } };
				},
			},
		},
	});
}
