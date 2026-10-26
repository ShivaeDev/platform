import { Clock, Effect } from "effect";
import { type FakeHttpRequest, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { APP_ID, APP_TOKEN, inspectJwt } from "./appFixture.ts";

export const appServer = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	const state: { exchanges: number; jwts: ReturnType<typeof inspectJwt>[] } = { exchanges: 0, jwts: [] };
	const tokens = new Set<string>();
	function check(request: FakeHttpRequest) {
		const observed = inspectJwt(request, clock.currentTimeMillisUnsafe());
		state.jwts.push(observed);
		return (
			observed.valid
			&& observed.header.alg === "RS256"
			&& observed.claims.iss === APP_ID
			&& observed.claims.iat === observed.now - 60
			&& observed.claims.exp > observed.now
			&& observed.claims.exp <= observed.now + 600
		);
	}
	const server = yield* fakeHttpService({
		routes: {
			app: { guard: check, path: "/app", reply: () => ({ body: { id: Number(APP_ID), slug: "widgets-app" } }) },
			installation: { guard: check, path: "/repos/acme/widgets/installation", reply: () => ({ body: { id: 7 } }) },
			installations: {
				guard: check,
				path: "/app/installations",
				reply: ({ query }) =>
					query.get("page") === "2"
						? { body: [{ account: { login: "other" }, id: 8 }] }
						: { body: [{ account: { login: "acme" }, id: 7 }], headers: { Link: '</app/installations?page=2>; rel="next"' } },
			},
			pull: {
				guard: (request) => tokens.has(request.headers.authorization ?? ""),
				path: "/repos/acme/widgets/pulls/1",
				reply: () => ({ body: { number: 1, title: "App read" } }),
			},
			repository: {
				guard: (request) => tokens.has(request.headers.authorization ?? ""),
				path: "/repos/acme/widgets",
				reply: () => ({ body: { id: 42, name: "widgets" } }),
			},
			token: {
				guard: check,
				method: "POST",
				path: "/app/installations/7/access_tokens",
				reply: () => {
					state.exchanges += 1;
					const token = `${APP_TOKEN}-${state.exchanges}`;
					tokens.add(`Bearer ${token}`);
					return { body: { "expires_at": new Date(clock.currentTimeMillisUnsafe() + 3_600_000).toISOString(), token } };
				},
			},
		},
	});
	return { server, state };
});
