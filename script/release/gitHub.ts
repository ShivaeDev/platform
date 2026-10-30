import { Effect, Schema } from "effect";
import { read, write } from "@shivaedev/github/GitHub.ts";
import { type ReleaseCiRun, releaseHoldReason } from "./holdReason.ts";

const Snapshot = Schema.Struct({
	data: Schema.Struct({
		repository: Schema.Struct({
			pullRequests: Schema.Struct({
				nodes: Schema.Array(
					Schema.Struct({
						headRefOid: Schema.String,
						isCrossRepository: Schema.Boolean,
						mergeQueueEntry: Schema.NullOr(Schema.Struct({ id: Schema.String })),
						number: Schema.Number,
						state: Schema.String,
					}),
				),
			}),
			ref: Schema.NullOr(Schema.Struct({ target: Schema.Struct({ oid: Schema.String }) })),
		}),
	}),
});
const Runs = Schema.Struct({
	workflowRuns: Schema.Array(
		Schema.Struct({
			conclusion: Schema.NullOr(Schema.String),
			headSha: Schema.String,
			status: Schema.String,
		}).pipe(Schema.encodeKeys({ headSha: "head_sha" })),
	),
}).pipe(Schema.encodeKeys({ workflowRuns: "workflow_runs" }));
const Pull = Schema.Struct({ number: Schema.Number });

const QUERY = `query($owner: String!, $name: String!) {
 repository(owner: $owner, name: $name) {
  ref(qualifiedName: "refs/heads/release/next") { target { oid } }
  pullRequests(first: 100, headRefName: "release/next", baseRefName: "main", states: OPEN) {
   nodes { number state headRefOid isCrossRepository mergeQueueEntry { id } }
  }
 }
}`;

export function releaseGitHub(repository: string) {
	const [owner, name] = repository.split("/");
	const pulls = `/repos/${repository}/pulls`;
	return {
		close: (number: number) => write("PATCH", `${pulls}/${number}`, { state: "closed" }, Pull),
		save: (number: number | undefined, title: string, body: string) =>
			number === undefined
				? write("POST", pulls, { base: "main", body, head: "release/next", title }, Pull)
				: write("PATCH", `${pulls}/${number}`, { body, title }, Pull),
		snapshot: Effect.fn("ReleaseGitHub.snapshot")(function* () {
			const result = yield* write("POST", "/graphql", { query: QUERY, variables: { name, owner } }, Snapshot);
			const current = result.data.repository;
			const pull = current.pullRequests.nodes.find((candidate) => !candidate.isCrossRepository);
			let run: ReleaseCiRun | undefined;
			if (pull !== undefined && pull.mergeQueueEntry === null) {
				const runs = yield* read(
					`/repos/${repository}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${pull.headRefOid}&per_page=1`,
					Runs,
				);
				run = runs.workflowRuns[0];
			}
			return { head: current.ref?.target.oid ?? "", hold: releaseHoldReason(pull, run), pull };
		}),
	};
}
