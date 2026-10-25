import { type Context, Effect, Schema, Stream } from "effect";
import { CheckRun, type CreateCheckRun, type UpdateCheckRun } from "#checkRuns.ts";
import type { GitHub } from "#GitHub.ts";
import { PullRequestComment, type StickyComment } from "#stickyComments.ts";

export function writeVerbs(client: Context.Service.Shape<typeof GitHub>) {
	return {
		createCheck: (input: typeof CreateCheckRun.Type) => client.createCheckRun("acme", "widgets", input),
		readCheck: (id: number) => Effect.flatMap(client.read(`/repos/acme/widgets/check-runs/${id}`), (response) => response.decode(CheckRun)),
		readComments: () =>
			Stream.unwrap(client.list("/repos/acme/widgets/issues/1/comments")).pipe(
				Stream.mapEffect((response) => response.decode(Schema.Array(PullRequestComment))),
				Stream.flatMap(Stream.fromIterable),
				Stream.runCollect,
			),
		updateCheck: (id: number, input: typeof UpdateCheckRun.Type) => client.updateCheckRun("acme", "widgets", id, input),
		upsertComment: (input: Omit<typeof StickyComment.Type, "owner" | "repo" | "number">) =>
			client.upsertStickyComment({ number: 1, owner: "acme", repo: "widgets", ...input }),
	};
}
