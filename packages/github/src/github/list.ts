import { Effect } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { bindGitHubContext } from "#adapters/bindGitHubContext.ts";
import { pagination } from "#adapters/pagination.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { requests } from "#requests.ts";

export function list(state: GitHubState) {
	return Effect.fn("GitHub.list")(function* <E = ServiceUnavailable>(
		path: string,
		beforeRequest?: (resource: string) => Effect.Effect<void, E>,
		byteLimit?: number,
	) {
		const { apiUrl, responseByteLimit = 1024 * 1024 } = yield* GitHubConfig;
		return yield* pagination({ apiUrl, request: requests(state), resource: state.rates.resource, responseByteLimit })(path, beforeRequest, byteLimit);
	}, bindGitHubContext);
}
