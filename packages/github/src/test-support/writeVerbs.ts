import { type Context, Effect, Option } from "effect";
import type { CreateCheckRun, FindCheckRun, UpdateCheckRun } from "#checkRuns.ts";
import type { GitHub } from "#GitHub.ts";
import type { StickyComment } from "#stickyComments.ts";
import type { FakeRepository } from "./fakeRepository.ts";
import { answered } from "./outcome.ts";

type Client = Context.Service.Shape<typeof GitHub>;
type Report = Omit<typeof StickyComment.Type, "owner" | "repo" | "number">;

export function writeVerbs(
	client: Client,
	{ writes, server }: FakeRepository,
	run: <A, E>(effect: Effect.Effect<A, E>) => Effect.Effect<A, E>,
	tell: (line: string) => void,
) {
	return {
		checkMutations: () =>
			Effect.sync(() =>
				server.requests
					.filter(({ method, path }) => method !== "GET" && path.includes("check-runs"))
					.map(({ method, path, body }) => ({ body: JSON.parse(body.toString()), method, path })),
			),
		checkOnGitHub: (id: number) =>
			Effect.suspend(() => {
				const check = writes.checks.find((candidate) => candidate.id === id);
				if (check === undefined) {
					return Effect.die(`GitHub holds no check ${id}`);
				}
				const { id: _, ...shown } = check;
				return Effect.succeed(shown);
			}),
		checkRequests: () =>
			Effect.sync(() =>
				server.requests.filter(({ path }) => path.includes("check-runs")).map(({ method, path, body }) => ({ body: body.toString(), method, path })),
			),
		commentsOnPullRequest: () => Effect.sync(() => writes.comments.map(({ body, user }) => `${user?.login ?? "ghost"}: ${body}`)),
		createCheck: (input: typeof CreateCheckRun.Type) => {
			tell(`the client creates the ${input.status} ${input.name} check`);
			return answered(run(client.createCheckRun("acme", "widgets", input)));
		},
		createInvalidCompletedCheck: (operation: "create" | "upsert" = "create") => {
			tell("an untyped caller creates a completed check without a conclusion");
			return answered(
				run(
					(operation === "create" ? client.createCheckRun : client.upsertCheckRun)(
						"acme",
						"widgets",
						JSON.parse('{"headSha":"abc","name":"Coverage","status":"completed"}'),
					),
				),
			);
		},
		findCheck: (input: typeof FindCheckRun.Type) => {
			tell("the client finds its latest matching check for the commit");
			return answered(run(client.findLatestCheckRun("acme", "widgets", input).pipe(Effect.map(Option.getOrNull))));
		},
		postReport: (report: Report) => {
			tell(`the client posts the ${report.marker} report to pull request 1`);
			return answered(run(client.upsertStickyComment({ number: 1, owner: "acme", repo: "widgets", ...report })));
		},
		updateCheck: (id: number, input: typeof UpdateCheckRun.Type) => {
			tell(`the client moves check ${id} to ${input.status}`);
			return answered(run(client.updateCheckRun("acme", "widgets", id, input)));
		},
		upsertCheck: (input: typeof CreateCheckRun.Type, appId?: number) => {
			tell(`the client creates or updates its ${input.name} check`);
			return answered(run(client.upsertCheckRun("acme", "widgets", input, appId)));
		},
	};
}
