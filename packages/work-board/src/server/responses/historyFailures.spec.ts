import { NodeServices } from "@effect/platform-node";
import { Effect, Layer, PubSub, Ref } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { documentRequests } from "#server/document/requests.ts";
import type { Change } from "#server/files/changes.ts";
import { Responses } from "#server/Responses.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { Workspace, WorkspaceConfig } from "#server/workspace.ts";
import { inboxSnapshot } from "#test/inboxFixture.ts";
import { capturedQuestionnaire, questionnaireSource } from "#test/questionnaire.ts";
import { questionId, revisionOf } from "./records.ts";

const preview = {
	context: questionnaireSource,
	id: questionId("investigation.choices", "direction", revisionOf(questionnaireSource), "decision.md"),
	item: "investigation.choices",
	reason: "Choose.",
	request: "direction",
	reviewedRevision: revisionOf(questionnaireSource),
	source: "decision.md",
};

const history = Effect.fn("Test.history")(function* (snapshot: Snapshot) {
	const changes = {
		events: yield* Effect.acquireRelease(PubSub.unbounded<Change>(), PubSub.shutdown),
		files: Effect.succeed([]),
		realRoot: "/board",
		revision: Effect.succeed(0),
		watching: yield* Ref.make(false),
	};
	return yield* Effect.flatMap(Responses, (service) => service.history(preview)).pipe(
		Effect.provide(Responses.layer),
		Effect.provide(Workspace.layer),
		Effect.provide(Layer.succeed(WorkspaceConfig, { changes, index: Effect.succeed(snapshot), root: "/board", writable: false })),
		Effect.provide(NodeServices.layer),
	);
});

it.live.each([
	{ message: "Check the source diagnostics and retry", snapshot: inboxSnapshot({}, ["unreadable.md"]) },
	{
		message: "Check the source diagnostics and retry",
		snapshot: inboxSnapshot({ "responses/broken.md": "---\nkind: response\n---\nIncomplete response" }),
	},
	{
		message: "Give each recorded question and response a unique ID",
		snapshot: inboxSnapshot({ "first.md": capturedQuestionnaire(), "second.md": capturedQuestionnaire() }),
	},
])("keeps unavailable response history typed with recovery instructions", function* ({ snapshot, message }) {
	const failure = yield* Effect.flip(history(snapshot));
	expect(failure).toBeInstanceOf(ServiceUnavailable);
	expect(failure.message).toContain(message);
});

it("discloses ambiguous document identity to the reader without selecting response history", () => {
	const snapshot = inboxSnapshot({ "first.md": questionnaireSource, "second.md": questionnaireSource });
	const document = snapshot.documents.at(0);
	expect(document).toBeDefined();
	if (document) {
		expect(documentRequests(document, questionnaireSource, snapshot)).toEqual([
			{
				id: "direction",
				open: false,
				sourceOpen: true,
				title: "Reading experience",
				unavailable: "Item identity is ambiguous; response history is unknown. Give each item a unique ID, then retry.",
			},
		]);
	}
});
