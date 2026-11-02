import { Schema } from "effect";

export const User = Schema.Struct({
	avatarUrl: Schema.String,
	htmlUrl: Schema.String,
	id: Schema.Number,
	login: Schema.String,
	type: Schema.String,
}).pipe(Schema.encodeKeys({ avatarUrl: "avatar_url", htmlUrl: "html_url" }));

export const Issue = Schema.Struct({
	body: Schema.NullOr(Schema.String),
	closedAt: Schema.NullOr(Schema.String),
	createdAt: Schema.String,
	htmlUrl: Schema.String,
	id: Schema.Number,
	labels: Schema.Array(Schema.Union([Schema.String, Schema.Struct({ name: Schema.optional(Schema.String) })])),
	number: Schema.Number,
	pullRequest: Schema.optional(Schema.Struct({ url: Schema.String })),
	state: Schema.Literals(["open", "closed"]),
	title: Schema.String,
	updatedAt: Schema.String,
	user: Schema.NullOr(User),
}).pipe(
	Schema.encodeKeys({ closedAt: "closed_at", createdAt: "created_at", htmlUrl: "html_url", pullRequest: "pull_request", updatedAt: "updated_at" }),
);

export const PullRequestFile = Schema.Struct({
	additions: Schema.Number,
	changes: Schema.Number,
	deletions: Schema.Number,
	filename: Schema.String,
	patch: Schema.optional(Schema.String),
	previousFilename: Schema.optional(Schema.String),
	sha: Schema.String,
	status: Schema.String,
}).pipe(Schema.encodeKeys({ previousFilename: "previous_filename" }));

export const CollaboratorPermission = Schema.Struct({
	permission: Schema.String,
	roleName: Schema.String,
	user: User,
}).pipe(Schema.encodeKeys({ roleName: "role_name" }));
