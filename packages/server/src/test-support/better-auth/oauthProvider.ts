import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";

export function oauthProvider() {
	return fakeHttpService({
		routes: {
			authorize: {
				path: "/login/oauth/authorize",
				reply: ({ query }) => {
					const callback = new URL(query.get("redirect_uri") ?? "");
					callback.searchParams.set("state", query.get("state") ?? "");
					callback.searchParams.set("code", "story-code");
					return { headers: { location: callback.href }, status: 302 };
				},
			},
			emails: {
				path: "/user/emails",
				reply: () => ({ body: [{ email: "alice@social.test", primary: true, verified: true }] }),
			},
			token: {
				method: "POST",
				path: "/login/oauth/access_token",
				reply: () => ({ body: { "access_token": "story-token", scope: "read:user,user:email", "token_type": "bearer" } }),
			},
			user: {
				path: "/user",
				reply: () => ({ body: { "avatar_url": null, email: "alice@social.test", id: 123, login: "alice", name: "Alice" } }),
			},
		},
	});
}
