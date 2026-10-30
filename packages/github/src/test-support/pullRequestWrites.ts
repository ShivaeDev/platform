import { Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { FakeHttpReply, FakeHttpRequest } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { PullRequestComment } from "#stickyComments.ts";

export const COMMENT_LIMIT = 65_536;
export const SUMMARY_LIMIT = 65_535;
export const BOT = "coverage[bot]";

const CommentBody = Schema.Struct({ body: Schema.String });
const Output = Schema.Struct({ summary: Schema.String, text: Schema.optional(Schema.String), title: Schema.String });
const Create = Schema.Struct({
	detailsUrl: Schema.optional(Schema.String),
	headSha: Schema.String,
	name: Schema.String,
	output: Schema.optional(Output),
	status: Schema.String,
}).pipe(Schema.encodeKeys({ detailsUrl: "details_url", headSha: "head_sha" }));
const Update = Schema.Struct({
	conclusion: Schema.optional(Schema.String),
	detailsUrl: Schema.optional(Schema.String),
	output: Schema.optional(Output),
	status: Schema.String,
}).pipe(Schema.encodeKeys({ detailsUrl: "details_url" }));

export interface CheckOnGitHub {
	readonly conclusion: string | null;
	readonly detailsUrl: string | null;
	readonly headSha: string;
	readonly id: number;
	readonly name: string;
	readonly output: { readonly summary: string | null; readonly text: string | null; readonly title: string | null };
	readonly status: string;
}

const commentTooLong: FakeHttpReply = {
	body: {
		errors: [{ code: "custom", field: "body", message: `body is too long (maximum is ${COMMENT_LIMIT} characters)`, resource: "IssueComment" }],
		message: "Validation Failed",
	},
	status: HttpStatus.fromLiteral("UnprocessableEntity"),
};

function summaryTooLong(length: number): FakeHttpReply {
	return {
		body: { message: `Invalid request.\n\nOnly ${SUMMARY_LIMIT} characters are allowed; ${length} were supplied.` },
		status: HttpStatus.fromLiteral("UnprocessableEntity"),
	};
}

function characters(text: string | undefined) {
	return [...(text ?? "")].length;
}

export function pullRequestWrites() {
	const state: { checks: CheckOnGitHub[]; comments: (typeof PullRequestComment.Encoded)[] } = { checks: [], comments: [] };
	function commentBody(request: FakeHttpRequest) {
		return Schema.decodeUnknownSync(Schema.fromJsonString(CommentBody))(request.body.toString());
	}
	function checkBody({ detailsUrl, headSha, ...check }: CheckOnGitHub) {
		return { ...check, "details_url": detailsUrl, "head_sha": headSha };
	}
	return {
		routes: {
			check: {
				path: "/repos/acme/widgets/check-runs/:id",
				reply: (request: FakeHttpRequest) => {
					const check = state.checks.find(({ id }) => id === Number(request.params.id));
					return check === undefined ? { status: HttpStatus.fromLiteral("NotFound") } : { body: checkBody(check) };
				},
			},
			comments: {
				path: "/repos/acme/widgets/issues/1/comments",
				reply: ({ query }: FakeHttpRequest) => {
					const page = Number(query.get("page") ?? 1);
					return {
						body: state.comments.slice((page - 1) * 2, page * 2),
						headers: page * 2 < state.comments.length ? { Link: `</repos/acme/widgets/issues/1/comments?page=${page + 1}>; rel="next"` } : {},
					};
				},
			},
			createCheck: {
				method: "POST",
				path: "/repos/acme/widgets/check-runs",
				reply: (request: FakeHttpRequest) => {
					const input = Schema.decodeUnknownSync(Schema.fromJsonString(Create))(request.body.toString());
					if (characters(input.output?.summary) > SUMMARY_LIMIT) {
						return summaryTooLong(characters(input.output?.summary));
					}
					const check = {
						...input,
						conclusion: null,
						detailsUrl: input.detailsUrl ?? null,
						id: state.checks.length + 1,
						output: { summary: input.output?.summary ?? null, text: input.output?.text ?? null, title: input.output?.title ?? null },
					};
					state.checks.push(check);
					return { body: checkBody(check), status: HttpStatus.fromLiteral("Created") };
				},
			},
			createComment: {
				method: "POST",
				path: "/repos/acme/widgets/issues/1/comments",
				reply: (request: FakeHttpRequest) => {
					const { body } = commentBody(request);
					if (characters(body) > COMMENT_LIMIT) {
						return commentTooLong;
					}
					const comment = { body, id: state.comments.length + 1, user: { login: BOT } };
					state.comments.push(comment);
					return { body: comment, status: HttpStatus.fromLiteral("Created") };
				},
			},
			editCheck: {
				method: "PATCH",
				path: "/repos/acme/widgets/check-runs/:id",
				reply: (request: FakeHttpRequest) => {
					const input = Schema.decodeUnknownSync(Schema.fromJsonString(Update))(request.body.toString());
					const index = state.checks.findIndex(({ id }) => id === Number(request.params.id));
					const check = state.checks[index];
					if (check === undefined) {
						return { status: HttpStatus.fromLiteral("NotFound") };
					}
					const edited = {
						...check,
						conclusion: input.conclusion ?? check.conclusion,
						detailsUrl: input.detailsUrl ?? check.detailsUrl,
						output: {
							summary: input.output?.summary ?? check.output.summary,
							text: input.output?.text ?? check.output.text,
							title: input.output?.title ?? check.output.title,
						},
						status: input.status,
					};
					state.checks[index] = edited;
					return { body: checkBody(edited) };
				},
			},
			editComment: {
				method: "PATCH",
				path: "/repos/acme/widgets/issues/comments/:id",
				reply: (request: FakeHttpRequest) => {
					const index = state.comments.findIndex(({ id }) => id === Number(request.params.id));
					const comment = state.comments[index];
					if (comment === undefined) {
						return { status: HttpStatus.fromLiteral("NotFound") };
					}
					const { body } = commentBody(request);
					if (characters(body) > COMMENT_LIMIT) {
						return commentTooLong;
					}
					state.comments[index] = { ...comment, body };
					return { body: state.comments[index] };
				},
			},
		},
		state,
	};
}
