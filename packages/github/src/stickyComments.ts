import { Effect, Option, Schema, Stream } from "effect";
import type { Representations } from "#representations.ts";

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

const CommentBody = Schema.Struct({ body: Schema.String });

export function stickyComments(client: Representations) {
	return {
		upsertStickyComment: Effect.fn("GitHub.upsertStickyComment")(function* (input: typeof StickyComment.Type) {
			const { owner, repo, number, marker, body, author, appId } = yield* Schema.decodeUnknownEffect(StickyComment)(input);
			const hiddenMarker = `<!-- ${marker} -->`;
			const root = `/repos/${owner}/${repo}/issues`;
			const pages = yield* client.list(`${root}/${number}/comments`);
			const existing = yield* pages.pipe(
				Stream.mapEffect((page) => page.decode(Schema.Array(PullRequestComment))),
				Stream.flatMap(Stream.fromIterable),
				Stream.filter(
					(comment) =>
						(author === undefined || comment.user?.login === author)
						&& (appId === undefined
							? comment.body.includes(hiddenMarker)
							: comment.body.startsWith(hiddenMarker) && comment.performedViaGithubApp?.id === appId && comment.user?.type === "Bot"),
				),
				Stream.runHead,
			);
			const payload = yield* Schema.encodeEffect(CommentBody)({ body: `${hiddenMarker}\n${body}` });
			const response = yield* Option.isSome(existing)
				? client.write("PATCH", `${root}/comments/${existing.value.id}`, payload)
				: client.write("POST", `${root}/${number}/comments`, payload);
			return yield* response.decode(PullRequestComment);
		}),
	};
}
