import { execFileSync } from "node:child_process";
import { type ReleaseCiRun, releaseHoldReason } from "./holdReason.ts";

export type GitHubRequest = (endpoint: string, method: string, body?: Readonly<Record<string, unknown>>) => string;

interface SnapshotResponse {
	data: {
		repository: {
			pullRequests: {
				nodes: { number: number; state: string; headRefOid: string; isCrossRepository: boolean; mergeQueueEntry: { id: string } | null }[];
			};
			ref: { target: { oid: string } } | null;
		};
	};
}

const QUERY = `query($owner: String!, $name: String!) {
	repository(owner: $owner, name: $name) {
		ref(qualifiedName: "refs/heads/release/next") { target { oid } }
		pullRequests(first: 100, headRefName: "release/next", baseRefName: "main", states: OPEN) {
			nodes { number state headRefOid isCrossRepository mergeQueueEntry { id } }
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
			const pull = current.pullRequests.nodes.find((candidate) => !candidate.isCrossRepository);
			let run: ReleaseCiRun | undefined;
			if (pull !== undefined && pull.mergeQueueEntry === null) {
				const runs: { "workflow_runs": ReleaseCiRun[] } = JSON.parse(
					api(`repos/${repository}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${pull.headRefOid}&per_page=1`, "GET"),
				);
				run = runs.workflow_runs[0];
			}
			return {
				head: current.ref?.target.oid ?? "",
				hold: releaseHoldReason(pull, run),
				pull,
			};
		},
	};
}
