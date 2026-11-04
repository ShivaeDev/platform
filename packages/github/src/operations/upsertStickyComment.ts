import { Effect, Option, Schema, Stream } from "effect";
import type { Representations } from "#representations.ts";
import { PullRequestComment, StickyComment } from "#stickyCommentSchemas.ts";

const CommentBody = Schema.Struct({ body: Schema.String });
export function upsertStickyComment(client: Representations) {
	return Effect.fn("GitHub.upsertStickyComment")(function* (input: typeof StickyComment.Type) {
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
	});
}
