import { Effect, Option, Schema, Stream } from "effect";
import { CheckRun, FindCheckRun } from "#checkRunSchemas.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { decodedPages } from "#pagedLists.ts";

export function findLatestCheckRun(state: GitHubState) {
	return Effect.fn("GitHub.findLatestCheckRun")(function* (owner: string, repo: string, input: typeof FindCheckRun.Type) {
		const { headSha, name, appId } = yield* Schema.decodeUnknownEffect(FindCheckRun)(input);
		const query = new URLSearchParams({ filter: "all", "per_page": "100" });
		if (name !== undefined) {
			query.set("check_name", name);
		}
		const pages = decodedPages(state, `/repos/${owner}/${repo}/commits/${encodeURIComponent(headSha)}/check-runs?${query}`, CheckRun, {
			arrayKey: "check_runs",
		});
		return yield* pages.pipe(
			Stream.flatMap((page) => Stream.fromIterable(page.items)),
			Stream.filter((run) => (name === undefined || run.name === name) && (appId === undefined || run.app?.id === appId)),
			Stream.runFold(
				() => Option.none<typeof CheckRun.Type>(),
				(latest, run) => (Option.isNone(latest) || run.id > latest.value.id ? Option.some(run) : latest),
			),
		);
	});
}
