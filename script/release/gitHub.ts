import { execFileSync } from "node:child_process";

export type GitHubRequest = (endpoint: string, method: string, body?: Readonly<Record<string, unknown>>) => string;

interface SnapshotResponse {
	data: {
		repository: {
			pullRequests: { nodes: { number: number; isCrossRepository: boolean; mergeQueueEntry: { id: string } | null }[] };
			ref: { target: { oid: string } } | null;
		};
	};
}

const QUERY = `query($owner: String!, $name: String!) {
	repository(owner: $owner, name: $name) {
		ref(qualifiedName: "refs/heads/release/next") { target { oid } }
		pullRequests(first: 100, headRefName: "release/next", baseRefName: "main", states: OPEN) {
			nodes { number isCrossRepository mergeQueueEntry { id } }
		}
	}
}`;

const request: GitHubRequest = (endpoint, method, body) =>
	execFileSync("gh", ["api", endpoint, "--method", method, ...(body === undefined ? [] : ["--input", "-"])], {
		encoding: "utf8",
		input: body === undefined ? undefined : JSON.stringify(body),
		stdio: ["pipe", "pipe", "inherit"],
	});

export function releaseGitHub(repository: string, api: GitHubRequest = request) {
	const [owner, name] = repository.split("/");
	const pulls = `repos/${repository}/pulls`;
	return {
		close: (number: number) => api(`${pulls}/${number}`, "PATCH", { state: "closed" }),
		dispatch: () => api(`repos/${repository}/actions/workflows/ci.yml/dispatches`, "POST", { ref: "release/next" }),
		save: (number: number | undefined, title: string, body: string) =>
			number === undefined
				? api(pulls, "POST", { base: "main", body, head: "release/next", title })
				: api(`${pulls}/${number}`, "PATCH", { body, title }),
		snapshot: () => {
			const result: SnapshotResponse = JSON.parse(
				api("graphql", "POST", {
					query: QUERY,
					variables: { name, owner },
				}),
			);
			const current = result.data.repository;
			return {
				head: current.ref?.target.oid ?? "",
				pull: current.pullRequests.nodes.find((pull) => !pull.isCrossRepository),
			};
		},
	};
}
