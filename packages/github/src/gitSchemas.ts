import { Schema } from "effect";
import { PullRequestFile, User } from "#repositorySchemas.ts";

const CommitIdentity = Schema.Struct({ date: Schema.String, email: Schema.String, name: Schema.String });
const CommitData = Schema.Struct({
	author: Schema.NullOr(CommitIdentity),
	committer: Schema.NullOr(CommitIdentity),
	message: Schema.String,
	tree: Schema.Struct({ sha: Schema.String, url: Schema.String }),
});

const commitFields = {
	author: Schema.NullOr(User),
	commit: CommitData,
	committer: Schema.NullOr(User),
	htmlUrl: Schema.String,
	parents: Schema.Array(Schema.Struct({ sha: Schema.String, url: Schema.String })),
	sha: Schema.String,
};

export const Commit = Schema.Struct(commitFields).pipe(Schema.encodeKeys({ htmlUrl: "html_url" }));

export const CommitDetail = Schema.Struct({
	...commitFields,
	files: Schema.optional(Schema.Array(PullRequestFile)),
	stats: Schema.Struct({ additions: Schema.Number, deletions: Schema.Number, total: Schema.Number }),
}).pipe(Schema.encodeKeys({ htmlUrl: "html_url" }));

export const Comparison = Schema.Struct({
	aheadBy: Schema.Number,
	behindBy: Schema.Number,
	commits: Schema.Array(Commit),
	files: Schema.optional(Schema.Array(PullRequestFile)),
	status: Schema.Literals(["diverged", "ahead", "behind", "identical"]),
	totalCommits: Schema.Number,
}).pipe(Schema.encodeKeys({ aheadBy: "ahead_by", behindBy: "behind_by", totalCommits: "total_commits" }));

export const GitTree = Schema.Struct({
	sha: Schema.String,
	tree: Schema.Array(
		Schema.Struct({
			mode: Schema.String,
			path: Schema.String,
			sha: Schema.String,
			size: Schema.optional(Schema.Number),
			type: Schema.Literals(["blob", "tree", "commit"]),
			url: Schema.optional(Schema.String),
		}),
	),
	truncated: Schema.Boolean,
	url: Schema.String,
});
