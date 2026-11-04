import { Effect } from "effect";
import { GitHubConfig } from "#GitHubConfig.ts";
import { initializeArtifacts } from "#initializeArtifacts.ts";
import { rateLimits } from "#rateLimits.ts";
import { representations } from "#representations.ts";
import { requests } from "#requests.ts";

export const initializeGitHub = Effect.gen(function* () {
	const config = yield* GitHubConfig;
	const rates = rateLimits();
	const archive = yield* initializeArtifacts(config.apiUrl, rates);
	const request = yield* requests(rates);
	const state = { apiUrl: config.apiUrl, rates, request, resource: rates.resource, responseByteLimit: config.responseByteLimit ?? 1024 * 1024 };
	const { get, ...client } = representations(state.apiUrl, request, rates.resource, state.responseByteLimit);
	return { ...state, archive, client };
});
