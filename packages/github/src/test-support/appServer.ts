import { Clock, Deferred, Effect } from "effect";
import { type FakeHttpRequest, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { APP_ID, APP_TOKEN, type AppJwt, appJwtOf, signedByApp } from "./appFixture.ts";
import { artifactFixture } from "./artifactFixture.ts";
import { mutationRoutes } from "./mutationRoutes.ts";
import { viewerFixture } from "./viewerFixture.ts";

export interface PullArrivals {
	readonly expected: number;
	readonly reached: Deferred.Deferred<void>;
	seen: number;
}

export const appServer = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	const state: { arrivals: PullArrivals | undefined; exchanges: number; jwts: (AppJwt | undefined)[] } = {
		arrivals: undefined,
		exchanges: 0,
		jwts: [],
	};
	const tokens = new Map<string, number>();
	function appRequest(request: FakeHttpRequest) {
		const jwt = appJwtOf(request.headers.authorization, clock.currentTimeMillisUnsafe());
		state.jwts.push(jwt);
		return signedByApp(jwt);
	}
	function installationToken(request: FakeHttpRequest) {
		return tokens.has(request.headers.authorization ?? "");
	}
	function pullArrives(request: FakeHttpRequest) {
		const arrivals = state.arrivals;
		if (arrivals !== undefined) {
			arrivals.seen += 1;
			if (arrivals.seen === arrivals.expected) {
				Deferred.doneUnsafe(arrivals.reached, Effect.void);
			}
		}
		return installationToken(request);
	}
	const archive = artifactFixture(() => server.url);
	const viewer = viewerFixture((request) => tokens.get(request.headers.authorization ?? ""));
	const server = yield* fakeHttpService({
		routes: {
			...viewer.routes,
			...archive.routes,
			...mutationRoutes,
			app: { guard: appRequest, path: "/app", reply: () => ({ body: { id: Number(APP_ID), slug: "widgets-app" } }) },
			artifactRedirect: { ...archive.routes.artifactRedirect, guard: installationToken },
			installation: { guard: appRequest, path: "/repos/acme/widgets/installation", reply: () => ({ body: { id: 7 } }) },
			installations: {
				guard: appRequest,
				path: "/app/installations",
				reply: ({ query }) =>
					query.get("page") === "2"
						? { body: [{ account: { login: "other" }, id: 8 }] }
						: { body: [{ account: { login: "acme" }, id: 7 }], headers: { Link: '</app/installations?page=2>; rel="next"' } },
			},
			installedRepositories: {
				guard: installationToken,
				path: "/installation/repositories",
				reply: (request) => {
					if (viewer.state.enabled) {
						return viewer.repositories(request);
					}
					const id = tokens.get(request.headers.authorization ?? "");
					return { body: { repositories: [{ id, name: `repository-${id}` }] }, headers: { "ETag": `"installation-${id}"` } };
				},
			},
			pull: { guard: pullArrives, path: "/repos/acme/widgets/pulls/1", reply: () => ({ body: { number: 1, title: "App read" } }) },
			token: {
				guard: appRequest,
				method: "POST",
				path: "/app/installations/:installationId/access_tokens",
				reply: (request) => {
					state.exchanges += 1;
					const token = `${APP_TOKEN}-${state.exchanges}`;
					tokens.set(`Bearer ${token}`, Number(request.params.installationId));
					return { body: { "expires_at": new Date(clock.currentTimeMillisUnsafe() + 3_600_000).toISOString(), token } };
				},
			},
		},
	});
	return { server, state, viewer: viewer.state };
});
