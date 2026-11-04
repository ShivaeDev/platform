import { Schema } from "effect";

export const PullRequestComment = Schema.Struct({
	body: Schema.String,
	id: Schema.Number,
	performedViaGithubApp: Schema.optional(Schema.NullOr(Schema.Struct({ id: Schema.Number }))),
	user: Schema.NullOr(Schema.Struct({ login: Schema.String, type: Schema.optional(Schema.String) })),
}).pipe(Schema.encodeKeys({ performedViaGithubApp: "performed_via_github_app" }));

export const StickyComment = Schema.Struct({
	appId: Schema.optional(Schema.Number),
	author: Schema.optional(Schema.String),
	body: Schema.String,
	marker: Schema.String,
	number: Schema.Number,
	owner: Schema.String,
	repo: Schema.String,
});
