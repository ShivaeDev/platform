import { Schema } from "effect";
import type { FakeHttpRequest } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { PullRequestComment } from "#stickyComments.ts";

const CommentBody = Schema.Struct({ body: Schema.String });
const Output = Schema.Struct({ summary: Schema.String, text: Schema.optional(Schema.String), title: Schema.String });
const Create = Schema.Struct({ headSha: Schema.String, name: Schema.String, output: Schema.optional(Output), status: Schema.String }).pipe(
	Schema.encodeKeys({ headSha: "head_sha" }),
);
const Update = Schema.Struct({ conclusion: Schema.optional(Schema.String), output: Schema.optional(Output), status: Schema.String });

export function pullRequestWrites() {
	const state: {
		comments: (typeof PullRequestComment.Type)[];
		checks: Array<{
			id: number;
			headSha: string;
			name: string;
			status: string;
			conclusion: string | null;
			output: { title: string | null; summary: string | null; text: string | null };
		}>;
	} = { checks: [], comments: [] };
	function commentBody(request: FakeHttpRequest) {
		return Schema.decodeUnknownSync(Schema.fromJsonString(CommentBody))(request.body.toString());
	}
	function checkBody({ headSha, ...check }: (typeof state.checks)[number]) {
		return { ...check, "head_sha": headSha };
	}
	return {
		routes: {
			check: {
				path: "/repos/acme/widgets/check-runs/:id",
				reply: (request: FakeHttpRequest) => {
					const check = state.checks.find(({ id }) => id === Number(request.params.id));
					return check === undefined ? { status: 404 } : { body: checkBody(check) };
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
					const check = {
						...input,
						conclusion: null,
						id: state.checks.length + 1,
						output: { summary: input.output?.summary ?? null, text: input.output?.text ?? null, title: input.output?.title ?? null },
					};
					state.checks.push(check);
					return { body: checkBody(check), status: 201 };
				},
			},
			createComment: {
				method: "POST",
				path: "/repos/acme/widgets/issues/1/comments",
				reply: (request: FakeHttpRequest) => {
					const comment = { ...commentBody(request), id: state.comments.length + 1, user: { login: "coverage[bot]" } };
					state.comments.push(comment);
					return { body: comment, status: 201 };
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
						return { status: 404 };
					}
					const edited = {
						...check,
						conclusion: input.conclusion ?? check.conclusion,
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
						return { status: 404 };
					}
					state.comments[index] = { ...comment, ...commentBody(request) };
					return { body: state.comments[index] };
				},
			},
		},
		state,
	};
}
