import { NodeServices } from "@effect/platform-node";
import { Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { HostConfig } from "#host/config.ts";
import { AnswerHostEngine } from "#test/AnswerHostEngine.ts";
import { answerHostVerbs } from "#test/answerHostVerbs.ts";
import { answerPublicationVerbs } from "#test/answerPublicationVerbs.ts";
import { answerPullRequestVerbs } from "#test/answerPullRequestVerbs.ts";
import { answerQueueVerbs } from "#test/answerQueueVerbs.ts";
import { answerReceiptVerbs } from "#test/answerReceiptVerbs.ts";
import { answerReplacementVerbs } from "#test/answerReplacement.ts";
import { task } from "#test/fleetHost.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";

const layer = Layer.merge(postgresLayer, NodeServices.layer);

export const answers = storyKit({
	after: { configuration: (engine: AnswerHostEngine) => engine.deploy() },
	around: withIsolatedDatabase,
	clock: "live",
	create: () => new AnswerHostEngine(),
	inspect: (engine) => engine.inspect(),
	layer,
	name: "fleet answer",
	runIf: postgresEnabled,
	stages: ["configuration"],
	verbs: (engine, story) => ({
		...answerHostVerbs(engine, story.tell),
		...answerReceiptVerbs(engine, story.tell),
		...answerPullRequestVerbs(engine),
		...answerQueueVerbs(engine),
		...answerReplacementVerbs(engine),
		...answerPublicationVerbs(engine),
	}),
});

export function answerWork(workIds: readonly string[], config: Partial<HostConfig> = {}) {
	return answers.trait("configuration", `approved work ${workIds.join(", ")}`, (engine) => {
		engine.files = Object.fromEntries(workIds.map((workId) => [`${workId}.md`, task(workId, "approved")]));
		engine.config = config;
	});
}

export const approvedPullRequest = answers.trait("configuration", "a host integrated with an approved PR", (engine) => {
	engine.approvedPr = true;
	engine.config = { intervalSeconds: 3600 };
});
