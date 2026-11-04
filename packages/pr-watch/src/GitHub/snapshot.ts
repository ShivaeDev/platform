import { Effect, Schema } from "effect";
import { checkFailures } from "#checkFailures.ts";
import { decode } from "#GitHub/decode.ts";
import { GitHubHttp } from "#GitHubHttp.ts";
import { type Options, type Snapshot, WatchError } from "#model.ts";

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

export const snapshot = Effect.fn("GitHub.snapshot")((options: Options, number: number, queued: ReadonlySet<number>) =>
	Effect.gen(function* () {
		const http = yield* GitHubHttp;
		const response = yield* http.get(`${options.apiUrl}/repos/${options.repository}/pulls/${number}`);
		const pr = yield* decode(Pull, response);
		if (pr.number !== number) {
			return yield* Effect.fail(new WatchError({ message: "GitHub returned the wrong PR", reason: "response" }));
		}
		const open = pr.state === "open" && !pr.merged;
		if (open && (pr.mergeable === null || pr.mergeableState === "unknown")) {
			return undefined;
		}
		const failed = open ? yield* checkFailures(options, number, pr.head.sha) : false;
		if (failed === undefined) {
			return undefined;
		}
		return {
			autoMerge: pr.autoMerge !== null,
			branch: pr.head.ref,
			dirty: pr.mergeableState === "dirty",
			failed,
			head: pr.head.sha,
			merged: pr.merged,
			number,
			queued: queued.has(number),
			state: pr.state,
			title: pr.title,
		} satisfies Snapshot;
	}),
);
