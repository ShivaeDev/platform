import { Effect } from "effect";
import { fakeGitHubApp, type GitHubAppAccess } from "@shivaedev/test-kits/github/fake.ts";
import type { FakeHttpRoute } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { APP_ID, credentials } from "#test/appFixture.ts";
import { artifactFixture } from "#test/artifactFixture.ts";
import { mutationRoutes } from "#test/mutationRoutes.ts";
import { viewerFixture } from "#test/viewerFixture.ts";

export const appServerAt = Effect.fnUntraced(function* (prefix: string) {
	const archive = artifactFixture(() => server.url);
	const viewer = viewerFixture((request) => installationOf(request));
	let installationOf: GitHubAppAccess["installationOf"];
	const { server, state } = yield* fakeGitHubApp({
		credentials,
		prefix,
		routes: (access) => {
			const { appRequest, installationToken } = access;
			installationOf = access.installationOf;
			const routes = {
				graphql: {
					guard: installationToken,
					method: "POST",
					path: prefix === "/api/v3" ? "/api/graphql" : "/graphql",
					reply: () => ({ body: { data: { viewer: { login: "widgets-app" } } } }),
				},
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
							: { body: [{ account: { login: "acme" }, id: 7 }], headers: { Link: `<${prefix}/app/installations?page=2>; rel="next"` } },
				},
				installedRepositories: {
					guard: installationToken,
					path: "/installation/repositories",
					reply: (request) => {
						if (viewer.state.enabled) {
							return viewer.repositories(request);
						}
						const id = installationOf(request);
						return { body: { repositories: [{ id, name: `repository-${id}` }] }, headers: { "ETag": `"installation-${id}"` } };
					},
				},
				pull: { guard: installationToken, path: "/repos/acme/widgets/pulls/1", reply: () => ({ body: { number: 1, title: "App read" } }) },
			} satisfies Record<string, FakeHttpRoute>;
			return Object.fromEntries(
				Object.entries(routes).map(([name, route]) => [
					name,
					{ ...route, path: name === "archive" || name === "graphql" ? route.path : `${prefix}${route.path}` },
				]),
			);
		},
	});
	return { server, state, viewer: viewer.state };
});

export const appServer = appServerAt("");
