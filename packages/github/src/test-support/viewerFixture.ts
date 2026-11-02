import type { FakeHttpRequest } from "@shivaedev/test-story/server/fakeHttpService.ts";

function repository(id: number, owner: string, name: string, isPrivate = true) {
	return { "html_url": `https://github.com/${owner}/${name}`, id, name, owner: { login: owner }, private: isPrivate };
}

export function viewerFixture(installation: (request: FakeHttpRequest) => number | undefined) {
	const state = {
		enabled: false,
		permissions: new Map([
			["acme/widgets/alice", "read"],
			["other/engine/alice", "admin"],
			["other/not-installed/alice", "admin"],
		]),
		repositories: new Map([
			[7, [repository(42, "acme", "widgets"), repository(43, "acme", "secret"), repository(44, "acme", "public", false)]],
			[8, [repository(45, "other", "engine")]],
		]),
	};
	return {
		repositories(request: FakeHttpRequest) {
			const id = installation(request);
			const repositories = state.repositories.get(id ?? 0) ?? [];
			const page = Number(request.query.get("page") ?? 1);
			return {
				body: { repositories: repositories.slice((page - 1) * 2, page * 2) },
				headers: repositories.length > page * 2 ? { Link: `</installation/repositories?per_page=100&page=${page + 1}>; rel="next"` } : {},
			};
		},
		routes: {
			accountId: {
				guard: (request: FakeHttpRequest) => installation(request) !== undefined,
				path: "/user/:id",
				reply: ({ params }: FakeHttpRequest) => ({ body: { login: params.id === "11" ? "alice" : `viewer-${params.id}` } }),
			},
			accountLogin: {
				guard: (request: FakeHttpRequest) => installation(request) !== undefined,
				path: "/users/:login",
				reply: ({ params }: FakeHttpRequest) => ({ body: { login: params.login } }),
			},
			viewerPermission: {
				guard: (request: FakeHttpRequest) => installation(request) !== undefined,
				path: "/repos/:owner/:repo/collaborators/:login/permission",
				reply: ({ params }: FakeHttpRequest) => {
					const permission = state.permissions.get(`${params.owner}/${params.repo}/${params.login}`);
					return permission === undefined ? { body: { message: "Not Found" }, status: 404 } : { body: { permission } };
				},
			},
		},
		state,
	};
}
