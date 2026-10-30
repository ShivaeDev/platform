import { type Context, Effect } from "effect";
import type { CreateCheckRun, UpdateCheckRun } from "#checkRuns.ts";
import type { GitHub } from "#GitHub.ts";
import type { StickyComment } from "#stickyComments.ts";
import type { FakeRepository } from "./fakeRepository.ts";
import { answered } from "./outcome.ts";

type Client = Context.Service.Shape<typeof GitHub>;
type Report = Omit<typeof StickyComment.Type, "owner" | "repo" | "number">;

export function writeVerbs(
	client: Client,
	{ writes }: FakeRepository,
	run: <A, E>(effect: Effect.Effect<A, E>) => Effect.Effect<A, E>,
	tell: (line: string) => void,
) {
	return {
		checkOnGitHub: (id: number) =>
			Effect.suspend(() => {
				const check = writes.checks.find((candidate) => candidate.id === id);
				if (check === undefined) {
					return Effect.die(`GitHub holds no check ${id}`);
				}
				const { id: _, ...shown } = check;
				return Effect.succeed(shown);
			}),
		commentsOnPullRequest: () => Effect.sync(() => writes.comments.map(({ body, user }) => `${user?.login ?? "ghost"}: ${body}`)),
		createCheck: (input: typeof CreateCheckRun.Type) => {
			tell(`the client creates the ${input.status} ${input.name} check`);
			return answered(run(client.createCheckRun("acme", "widgets", input)));
		},
		postReport: (report: Report) => {
			tell(`the client posts the ${report.marker} report to pull request 1`);
			return answered(run(client.upsertStickyComment({ number: 1, owner: "acme", repo: "widgets", ...report })));
		},
		updateCheck: (id: number, input: typeof UpdateCheckRun.Type) => {
			tell(`the client moves check ${id} to ${input.status}`);
			return answered(run(client.updateCheckRun("acme", "widgets", id, input)));
		},
	};
}
