import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveForm } from "#test/answerTraits.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { silentWatch } from "#test/faults.ts";
import { screenStory } from "#test/screenStory.ts";
import { sessionBoundary } from "#test/sessionTransport.ts";

expectNoReactWarnings();

const DRAFT = "Keep this direction";

for (const kind of ["response", "handoff"] as const) {
	const command = kind === "response" ? "work-board-responses.answerQuestion" : "work-board-handoffs.prepareHandoff";
	const saved = kind === "response" ? "Answer saved." : "Saved handoffs/";
	const failures = [
		{ cause: "the item changed since the preview", status: "Rejected: PreconditionFailed:" },
		{ cause: "the page can't deliver commands", status: "Uncertain:" },
	] as const;

	for (const { cause, status } of failures) {
		screenStory.it(
			`saving a ${kind} after ${cause} keeps the draft and says "${status}" with the draft retained`,
			[sessionBoundary(command, silentWatch), liveForm(kind)],
			function* ({ editSessionFile, fillLiveForm, liveFormDraft, liveFormStatus, previewLiveForm, saveLiveForm, setSessionOffline }) {
				yield* fillLiveForm(kind, DRAFT);
				yield* previewLiveForm(kind);
				if (status === "Uncertain:") {
					yield* setSessionOffline(true);
				} else {
					yield* editSessionFile("item.md", `${EDGE_ATTENTION_SOURCE}Changed reviewed source.\n`);
				}

				yield* saveLiveForm(kind);

				yield* outcomes({
					draft: [liveFormDraft(kind), DRAFT],
					status: [liveFormStatus(kind), expect.stringMatching(new RegExp(`${status}.*Draft retained`, "su"))],
				});
			},
		);

		screenStory.it(
			`once ${cause} is resolved, saving the ${kind} again succeeds with the same identity it was first sent with`,
			[sessionBoundary(command, silentWatch), liveForm(kind)],
			function* ({ editSessionFile, fillLiveForm, liveFormStatus, previewLiveForm, saveLiveForm, sentCommandIds, setSessionOffline }) {
				yield* fillLiveForm(kind, DRAFT);
				yield* previewLiveForm(kind);
				if (status === "Uncertain:") {
					yield* setSessionOffline(true);
				} else {
					yield* editSessionFile("item.md", `${EDGE_ATTENTION_SOURCE}Changed reviewed source.\n`);
				}
				yield* saveLiveForm(kind);
				const [first = "no command was sent"] = yield* sentCommandIds();
				yield* editSessionFile("item.md", EDGE_ATTENTION_SOURCE);
				yield* setSessionOffline(false);
				yield* previewLiveForm(kind);

				yield* saveLiveForm(kind);

				yield* outcomes({
					identities: [sentCommandIds(), [first, first]],
					status: [liveFormStatus(kind), expect.stringContaining(saved)],
				});
			},
		);
	}

	screenStory.it(
		`newer ${kind} text typed while a save is on its way stays as an unsaved draft, and the save keeps the text it was sent with`,
		[sessionBoundary(command), liveForm(kind)],
		function* ({ fillLiveForm, liveFormDraft, liveFormStatus, pauseCommand, previewLiveForm, readSessionFiles, releaseCommand, saveLiveForm }) {
			yield* fillLiveForm(kind, "First reviewed direction");
			yield* previewLiveForm(kind);
			yield* pauseCommand();
			yield* saveLiveForm(kind);
			yield* fillLiveForm(kind, "New direction typed while saving");

			yield* releaseCommand();

			yield* outcomes({
				draft: [liveFormDraft(kind), "New direction typed while saving"],
				saved: [
					readSessionFiles(kind === "response" ? "responses" : "handoffs"),
					[expect.stringMatching(/^(?!.*New direction typed while saving).*First reviewed direction/su)],
				],
				status: [
					liveFormStatus(kind),
					expect.stringContaining(kind === "response" ? "Your current draft remains unsaved" : "Your newer draft remains unsaved"),
				],
			});
		},
	);
}

screenStory.it(
	"the rejection after the item changed says in full why and what the reader can do next",
	[sessionBoundary("work-board-responses.answerQuestion", silentWatch), liveForm("response")],
	function* ({ editSessionFile, fillLiveForm, liveFormStatus, previewLiveForm, saveLiveForm }) {
		yield* fillLiveForm("response", DRAFT);
		yield* previewLiveForm("response");
		yield* editSessionFile("item.md", `${EDGE_ATTENTION_SOURCE}Changed reviewed source.\n`);

		yield* saveLiveForm("response");

		expect(yield* liveFormStatus("response")).toBe(
			"Rejected: PreconditionFailed: Source changed since review. Read it again before registering this question.. Draft retained. Preview and retry with the same identity; saved content will be reconciled.",
		);
	},
);
