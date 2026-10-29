import { Context, Effect, Layer } from "effect";
import { resolveHost } from "#host/config.ts";
import { gitMainSource, MainSource } from "#host/mainSource.ts";
import { mergePrediction } from "#host/mergePrediction.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { predictionRepository } from "#test/predictionRepository.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

export const watchedBranches = isolatedEngine.trait(
	"configuration",
	"pushed worker branches are predicted with Git on a real repository",
	function* (state) {
		const repository = yield* predictionRepository;
		state.predictionRepository = repository;
		const host = resolveHost(repository.cwd, { database: syntheticDatabase, provider: "local" });
		const main = Context.get(yield* Layer.build(gitMainSource(host)), MainSource);
		state.predictionMain = main;
		state.options = {
			...state.options,
			areaMergeWaitMs: 1000,
			backlog: 10,
			concurrency: 4,
			deliveryQuery: (result) => Effect.sync(() => repository.delivery(result)),
			predict: mergePrediction(repository.github, main, Effect.succeed("example/project")),
			publicationQuery: (work) => repository.publication(work.workId),
			resultQuery: (work) => Effect.sync(() => repository.result(work.workId)),
		};
	},
);
