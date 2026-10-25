import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { DecisionCode } from "#DecisionCode.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { FleetHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubDelivery, readPullRequest } from "#host/githubDelivery.ts";
import { githubPublication } from "#host/githubPublication.ts";
import { githubResult } from "#host/githubResult.ts";
import { MainSource } from "#host/mainSource.ts";
import { mergePrediction } from "#host/mergePrediction.ts";
import { reportRepository } from "#host/reportPublication.ts";
import { reportRevision } from "#host/reportRevision.ts";
import { FleetIntegrations } from "#policy.ts";

function unconfigured(message: string, code: DecisionCode = "fleet-integration") {
	return Effect.fail(withFailureContext(new ServiceUnavailable({ message }), { attentionOwner: "automation", code, retryable: false }));
}

export function hostIntegrations(host: FleetHost) {
	const HostIntegrations = defineService({
		id: "Fleet/HostIntegrations",
		initialize: Effect.all({ github: GithubApi, main: MainSource }),
		methods: ({ github, main }) => {
			const repository = reportRepository(main.repositoryRoot, host.repository.remote).pipe(Effect.provide(NodeServices.layer));
			const prediction = main.mergeConflicts === undefined ? {} : { predict: mergePrediction(github, main, repository) };
			return FleetIntegrations.of({
				...prediction,
				checks: (_work, result) =>
					result.kind === "no-change"
						? unconfigured("No-change validation is not configured in this Fleet host; inspect the worker session", "no-change-checks-unconfigured")
						: githubChecks(github, host.repository.branch)(result),
				delivery: githubDelivery(readPullRequest(github.get)),
				isAncestor: reportRevision(main.repositoryRoot, host.repository.remote),
				main: main.observe,
				publication: githubPublication(host, github, repository),
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
