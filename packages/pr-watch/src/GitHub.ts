import { Effect, Schema } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { GitHubHttp } from "./GitHubHttp.ts";
import { type Options, type Snapshot, WatchError } from "./model.ts";

const Pull = Schema.Struct({
	autoMerge: Schema.NullOr(Schema.Struct({ mergeMethod: Schema.String }).pipe(Schema.encodeKeys({ mergeMethod: "merge_method" }))),
	head: Schema.Struct({ ref: Schema.String, sha: Schema.String }),
	mergeable: Schema.NullOr(Schema.Boolean),
	mergeableState: Schema.String,
	merged: Schema.Boolean,
	number: Schema.Int,
	state: Schema.Literals(["open", "closed"]),
	title: Schema.String,
}).pipe(Schema.encodeKeys({ autoMerge: "auto_merge", mergeableState: "mergeable_state" }));
const Ref = Schema.Struct({ ref: Schema.String });
const ListedPull = Schema.Struct({ number: Schema.Int });
const Check = Schema.Struct({ conclusion: Schema.NullOr(Schema.String), status: Schema.String });
const Checks = Schema.Struct({ checkRuns: Schema.Array(Check) }).pipe(Schema.encodeKeys({ checkRuns: "check_runs" }));
const Status = Schema.Struct({ state: Schema.String });
const failures = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"]);
export const GitHub = defineService({
	id: "@shivaedev/pr-watch/GitHub",
	initialize: GitHubHttp,
	methods: (http) => {
		function decode<TSchema extends Schema.Top>(schema: TSchema, body: unknown) {
			return Schema.decodeUnknownEffect(schema)(body).pipe(Effect.mapError(() => new WatchError({ message: "Invalid GitHub response" })));
		}
		function pages(options: Options, path: string) {
			return Effect.gen(function* () {
				const bodies: unknown[] = [];
				const visited = new Set<string>();
				let url: string | undefined = `${options.apiUrl}/repos/${options.repository}${path}`;
				while (url !== undefined) {
					if (visited.has(url)) {
						return yield* Effect.fail(new WatchError({ message: "Repeated pagination URL" }));
					}
					visited.add(url);
					const response: Effect.Success<ReturnType<typeof http.get>> = yield* http.get(url, options.token);
					bodies.push(response.body);
					url = response.next;
				}
				return bodies;
			});
		}
		return {
			delay: http.delay,
			discover: (options: Options) =>
				Effect.gen(function* () {
					const bodies = yield* pages(options, "/pulls?state=open&per_page=100");
					const lists = yield* Effect.forEach(bodies, (body) => decode(Schema.Array(ListedPull), body));
					return lists.flat().map((pr) => pr.number);
				}),
			queue: (options: Options) =>
				Effect.gen(function* () {
					const bodies = yield* pages(options, "/git/matching-refs/heads/gh-readonly-queue/");
					const lists = yield* Effect.forEach(bodies, (body) => decode(Schema.Array(Ref), body));
					return new Set(
						lists.flat().flatMap(({ ref }) => {
							const number = ref.match(/\/pr-(?<number>\d+)-/u)?.groups?.number;
							return number === undefined ? [] : [Number(number)];
						}),
					);
				}),
			snapshot: (options: Options, number: number, queued: ReadonlySet<number>) =>
				Effect.gen(function* () {
					const response = yield* http.get(`${options.apiUrl}/repos/${options.repository}/pulls/${number}`, options.token);
					const pr = yield* decode(Pull, response.body);
					if (pr.number !== number) {
						return yield* Effect.fail(new WatchError({ message: "GitHub returned the wrong PR" }));
					}
					if (pr.state === "open" && (pr.mergeable === null || pr.mergeableState === "unknown")) {
						return yield* Effect.fail(new WatchError({ message: `Mergeability pending for PR #${number}` }));
					}
					let failed = false;
					if (pr.state === "open") {
						const bodies = yield* pages(options, `/commits/${pr.head.sha}/check-runs?per_page=100&filter=latest`);
						const checks = yield* Effect.forEach(bodies, (body) => decode(Checks, body));
						const statusResponse = yield* http.get(`${options.apiUrl}/repos/${options.repository}/commits/${pr.head.sha}/status`, options.token);
						const status = yield* decode(Status, statusResponse.body);
						failed =
							checks.some((page) => page.checkRuns.some((check) => check.status === "completed" && failures.has(check.conclusion ?? "")))
							|| ["failure", "error"].includes(status.state);
					}
					return {
						autoMerge: pr.autoMerge !== null,
						branch: pr.head.ref,
						dirty: pr.mergeableState === "dirty",
						failed,
						merged: pr.merged,
						number,
						queued: queued.has(number),
						state: pr.state,
						title: pr.title,
					} satisfies Snapshot;
				}),
		};
	},
	requires: [GitHubHttp],
});
