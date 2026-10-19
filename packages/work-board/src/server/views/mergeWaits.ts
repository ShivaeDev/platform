import { attentionRequests, isMaintainerRequest } from "#server/attention/requests.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

const mergeReasons = new Set([
	"The PR passed review and all required checks. It is ready to merge.",
	"The sweep PR passed review and all required checks. It is ready to merge before held PRs.",
	"Reviewed PR is ready to merge",
	"Reviewed sweep PR is ready to merge",
]);

export function mergeWaits(snapshot: Snapshot): ReadonlySet<string> {
	return new Set(
		attentionRequests(snapshot).entries.flatMap(({ request, answer, problem }) =>
			request.managed && !answer && !problem && isMaintainerRequest(request, snapshot.maintainer) && mergeReasons.has(request.reason)
				? request.unblocks.map((target) => target.split("#")[0] ?? target)
				: [],
		),
	);
}
