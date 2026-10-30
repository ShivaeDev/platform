import { Effect, Schema } from "effect";
import { GitHubHttp } from "#GitHubHttp.ts";
import { type Options, WatchError } from "#model.ts";

const Check = Schema.Struct({ conclusion: Schema.NullOr(Schema.String), nodeId: Schema.String, status: Schema.String }).pipe(
	Schema.encodeKeys({ nodeId: "node_id" }),
);
const Checks = Schema.Struct({ checkRuns: Schema.Array(Check) }).pipe(Schema.encodeKeys({ checkRuns: "check_runs" }));
const Status = Schema.Struct({ statuses: Schema.Array(Schema.Struct({ context: Schema.String, state: Schema.String })) });
const Context = Schema.Union([
	Schema.Struct({ __typename: Schema.Literal("CheckRun"), id: Schema.String, isRequired: Schema.Boolean }),
	Schema.Struct({ __typename: Schema.Literal("StatusContext"), context: Schema.String, isRequired: Schema.Boolean }),
]);
const Errors = Schema.Struct({ errors: Schema.optionalKey(Schema.Array(Schema.Struct({ message: Schema.String }))) });
const Required = Schema.Struct({
	data: Schema.Struct({
		repository: Schema.Struct({
			object: Schema.Struct({
				statusCheckRollup: Schema.Struct({
					contexts: Schema.Struct({
						nodes: Schema.Array(Context),
						pageInfo: Schema.Struct({ endCursor: Schema.NullOr(Schema.String), hasNextPage: Schema.Boolean }),
					}),
				}),
			}),
		}),
	}),
});
const query = `query RequiredChecks($owner: String!, $name: String!, $sha: String!, $number: Int!, $after: String) {
	repository(owner: $owner, name: $name) {
		object(expression: $sha) {
			... on Commit {
				statusCheckRollup {
					contexts(first: 100, after: $after) {
						nodes {
							__typename
							... on CheckRun { id isRequired(pullRequestNumber: $number) }
							... on StatusContext { context isRequired(pullRequestNumber: $number) }
						}
						pageInfo { endCursor hasNextPage }
					}
				}
			}
		}
	}
}`;
const failures = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"]);
function decode<TSchema extends Schema.Top>(schema: TSchema, body: unknown) {
	return Schema.decodeUnknownEffect(schema)(body).pipe(
		Effect.mapError((cause) => new WatchError({ message: "Invalid GitHub checks response", reason: "response" }, { cause })),
	);
}
export const checkFailures = Effect.fn("GitHub.checkFailures")(function* (options: Options, number: number, sha: string) {
	const http = yield* GitHubHttp;
	const base = `${options.apiUrl}/repos/${options.repository}`;
	const bodies = yield* http.list(`${base}/commits/${sha}/check-runs?per_page=100&filter=latest`);
	const checks = yield* Effect.forEach(bodies, (body) => decode(Checks, body));
	const statusBodies = yield* http.list(`${base}/commits/${sha}/status`);
	const statuses = yield* Effect.forEach(statusBodies, (body) => decode(Status, body));
	const failedChecks = new Set(
		checks.flatMap((page) =>
			page.checkRuns.filter((check) => check.status === "completed" && failures.has(check.conclusion ?? "")).map((check) => check.nodeId),
		),
	);
	const failedStatuses = new Set(
		statuses.flatMap((page) => page.statuses.filter((context) => ["failure", "error"].includes(context.state)).map((context) => context.context)),
	);
	if (failedChecks.size === 0 && failedStatuses.size === 0) {
		return false;
	}
	const [owner, name] = options.repository.split("/");
	let after: string | null = null;
	let failed = false;
	do {
		const response: unknown = yield* http.graphql(options.apiUrl, query, { after, name, number, owner, sha });
		const { errors } = yield* decode(Errors, response);
		if (errors !== undefined && errors.length > 0) {
			return yield* new WatchError(
				{ message: `GitHub required checks: ${errors.map((error) => error.message).join("; ")}`, reason: "response" },
				{ cause: errors },
			);
		}
		const body = yield* decode(Required, response);
		const { nodes, pageInfo } = body.data.repository.object.statusCheckRollup.contexts;
		failed ||= nodes.some(
			(context) => context.isRequired && (context.__typename === "CheckRun" ? failedChecks.has(context.id) : failedStatuses.has(context.context)),
		);
		after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
	} while (after !== null);
	return failed;
});
