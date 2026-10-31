import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { FleetHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubDelivery, readPullRequest } from "#host/githubDelivery.ts";
import { githubMergeQueue } from "#host/githubMergeQueue.ts";
import { githubPublication } from "#host/githubPublication.ts";
import { githubResult } from "#host/githubResult.ts";
import { MainSource } from "#host/mainSource.ts";
import { mergePrediction } from "#host/mergePrediction.ts";
import { noChangeChecks } from "#host/noChangeChecks.ts";
import { reportRepository } from "#host/reportPublication.ts";
import { reportRevision } from "#host/reportRevision.ts";
import { FleetIntegrations } from "#policy.ts";

function unconfigured(message: string) {
	return Effect.fail(
		withFailureContext(new ServiceUnavailable({ message }), { attentionOwner: "automation", code: "fleet-integration", retryable: false }),
	);
}

export function hostIntegrations(host: FleetHost) {
	const HostIntegrations = defineService({
		id: "Fleet/HostIntegrations",
		initialize: Effect.all({ github: GithubApi, main: MainSource }),
		methods: ({ github, main }) => {
			const repository = reportRepository(main.repositoryRoot, host.repository.remote).pipe(Effect.provide(NodeServices.layer));
			const isAncestor = reportRevision(main.repositoryRoot, host.repository.remote);
			const prediction = main.mergeConflicts === undefined ? {} : { predict: mergePrediction(github, main, repository) };
			return FleetIntegrations.of({
				...prediction,
				checks: (_work, result) =>
					result.kind === "no-change" ? noChangeChecks(main.latest, isAncestor)(result) : githubChecks(github, host.repository.branch)(result),
				...(host.worker === undefined
					? {}
					: { queue: (work, result, queued) => githubMergeQueue(host)(work, result, queued).pipe(Effect.provideService(GithubApi, github)) }),
				delivery: githubDelivery(readPullRequest(github.get)),
				isAncestor,
				main: main.observe,
				...(host.worker === undefined ? {} : { publication: githubPublication(host, github, repository) }),
				result:
					host.result === "github"
						? githubResult(host, github, repository)
						: () => unconfigured("Worker result adoption is not configured in this Fleet host; inspect the worker session"),
			});
		},
		requires: [MainSource, GithubApi],
	});
	return Layer.effect(FleetIntegrations)(HostIntegrations).pipe(Layer.provide(HostIntegrations.layer));
}
