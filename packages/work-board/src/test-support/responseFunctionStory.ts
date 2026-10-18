import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { currentResponses } from "#responses/current.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { agentRequest } from "#server/responses/agent.ts";
import { runAgent } from "#server/responses/agent-cli.ts";
import { flags } from "#server/responses/flags.ts";
import { outcome } from "#server/responses/outcome.ts";
import { questionTemplate } from "#server/responses/template.ts";
import { validatedInput } from "#server/responses/validatedInput.ts";
import { waitForResponse } from "#server/responses/waitFor.ts";

export const responseFunctionStory = storyKit({
	create: () => undefined,
	name: "response functions",
	stages: [],
	verbs: () => ({ agentRequest, currentResponses, flags, metadataParse, outcome, questionTemplate, runAgent, validatedInput, waitForResponse }),
});
