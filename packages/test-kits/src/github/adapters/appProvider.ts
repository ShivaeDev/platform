import { Clock, Effect } from "effect";
import type { FakeHttpRequest } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { AppJwt, githubAppCredentials } from "#github/adapters/credentials.ts";
import type { GitHubAppAccess } from "#github/fake.ts";

export const appProvider = Effect.fnUntraced(function* (credentials: ReturnType<typeof githubAppCredentials>, prefix: string) {
	const clock = yield* Clock.Clock;
	const state: { exchanges: number; jwts: (AppJwt | undefined)[] } = { exchanges: 0, jwts: [] };
	const tokens = new Map<string, number>();
	const access: GitHubAppAccess = {
		appRequest: (request) => {
			const jwt = credentials.appJwtOf(request.headers.authorization, clock.currentTimeMillisUnsafe());
			state.jwts.push(jwt);
			return credentials.signedByApp(jwt);
		},
		installationOf: (request) => tokens.get(request.headers.authorization ?? ""),
		installationToken: (request) => tokens.has(request.headers.authorization ?? ""),
	};
	return {
		access,
		state,
		token: {
			guard: access.appRequest,
			method: "POST",
			path: `${prefix}/app/installations/:installationId/access_tokens`,
			reply: (request: FakeHttpRequest) => {
				state.exchanges += 1;
				const token = `${credentials.tokenPrefix}-${state.exchanges}`;
				tokens.set(`Bearer ${token}`, Number(request.params.installationId));
				return { body: { "expires_at": new Date(clock.currentTimeMillisUnsafe() + 3_600_000).toISOString(), token } };
			},
		},
	};
});
