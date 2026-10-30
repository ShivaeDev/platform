import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { silentWatch } from "#test/faults.ts";
import { screenStory } from "#test/screenStory.ts";
import { sessionScreen } from "#test/sessionScreen.ts";
import { sessionBoundary } from "#test/sessionTransport.ts";

expectNoReactWarnings();
for (const kind of ["response", "handoff"] as const) {
	const command = kind === "response" ? "work-board-responses.answerQuestion" : "work-board-handoffs.prepareHandoff";
	const field = kind === "response" ? '[name="body"]' : '[name="goal"]';
	for (const failure of ["rejection", "transport"] as const) {
		screenStory.it(
			`classifies ${kind} ${failure} and retries its retained identity over the shared socket`,
			[sessionBoundary(command, silentWatch), sessionScreen(kind)],
			function* ({ input, activate, submit, findElement, readText, setSessionOffline, editSessionFile, sessionCommands }) {
				yield* eventually(() => expect(findElement(`#${kind}-preview`)).toHaveProperty("disabled", false));
				if (kind === "handoff") {
					input('[name="recipient"]', "local-reviewer");
				}
				const draft = input(field, "Keep this direction");
				yield* Effect.promise(() => activate(`#${kind}-preview`));
				const identity = readText(`#${kind}-preview-content`)?.match(/\b(?:response|handoff)\.[\da-f-]{36}/u)?.[0];
				expect(identity).toBeDefined();
				if (failure === "rejection") {
					editSessionFile("item.md", `${EDGE_ATTENTION_SOURCE}Changed reviewed source.\n`);
				} else {
					yield* Effect.promise(() => setSessionOffline(true));
				}
				submit(`#${kind}-form`);
				yield* eventually(() =>
					expect(readText(`#${kind}-status`)).toContain(failure === "rejection" ? "Rejected: PreconditionFailed:" : "Uncertain:"),
				);
				expect(readText(`#${kind}-status`)).toContain("Draft retained");
				if (kind === "response" && failure === "rejection") {
					expect(readText("#response-status")).toBe(
						"Rejected: PreconditionFailed: Source changed since review. Read it again before registering this question.. Draft retained. Preview and retry with the same identity; saved content will be reconciled.",
					);
				}
				expect(draft.value).toBe("Keep this direction");
				editSessionFile("item.md", EDGE_ATTENTION_SOURCE);
				yield* Effect.promise(() => setSessionOffline(false));
				yield* Effect.promise(() => activate(`#${kind}-preview`));
				submit(`#${kind}-form`);
				yield* eventually(() => expect(readText(`#${kind}-status`)).toContain(kind === "response" ? "Answer saved." : "Saved handoffs/"));
				expect(sessionCommands()).toMatchObject([
					{ payload: { id: identity }, tag: command },
					{ payload: { id: identity }, tag: command },
				]);
			},
		);
	}
	screenStory.it(
		`retains newer ${kind} input while saving the captured command`,
		[sessionBoundary(command), sessionScreen(kind)],
		function* ({ input, activate, submit, findElement, readText, pauseCommand, releaseCommand, sessionCommands, readSessionFiles, stored }) {
			yield* eventually(() => expect(findElement(`#${kind}-preview`)).toHaveProperty("disabled", false));
			if (kind === "handoff") {
				input('[name="recipient"]', "local-reviewer");
			}
			const draft = input(field, "First reviewed direction");
			yield* Effect.promise(() => activate(`#${kind}-preview`));
			pauseCommand();
			submit(`#${kind}-form`);
			yield* eventually(() =>
				expect(sessionCommands()).toMatchObject([
					{
						payload: expect.objectContaining(kind === "response" ? { body: "First reviewed direction" } : { goal: "First reviewed direction" }),
						tag: command,
					},
				]),
			);
			input(field, "New direction typed while saving");
			expect(findElement(`#${kind}-submit`)).toHaveProperty("disabled", true);
			yield* Effect.promise(() => releaseCommand());
			yield* eventually(() =>
				expect(readText(`#${kind}-status`)).toContain(
					kind === "response" ? "Your current draft remains unsaved" : "Your newer draft remains unsaved",
				),
			);
			expect(draft.value).toBe("New direction typed while saving");
			const saved = readSessionFiles(kind === "response" ? "responses" : "handoffs");
			expect(saved.some((source) => source.includes("First reviewed direction"))).toBe(true);
			expect(saved.some((source) => source.includes("New direction typed while saving"))).toBe(false);
			if (kind === "handoff") {
				expect([...Object.keys(localStorage)].some((key) => stored(key)?.includes("New direction typed while saving"))).toBe(true);
				return;
			}
			yield* Effect.promise(() => activate(`#${kind}-preview`));
			submit(`#${kind}-form`);
			yield* eventually(() =>
				expect(
					readSessionFiles(kind === "response" ? "responses" : "handoffs").some((source) => source.includes("New direction typed while saving")),
				).toBe(true),
			);
		},
	);
}
