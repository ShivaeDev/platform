import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { Effect, Order, Schema } from "effect";
import type { Handoff, HandoffInput } from "#browser/handoffs/schema.ts";
import { changedOutside, markup, projectPath, publicationSetup, textIn } from "./publicationFaults.ts";
import { renderRemaining } from "./renderRemaining.tsx";
import { settledCall } from "./responseOutcome.ts";
import { type BoardEngine, served } from "./storyEngine.ts";
import { handoffInput } from "./storyResponses.ts";

const RECORD = "handoffs/handoff.keyboard.1.md";

export function handoffVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const setup = publicationSetup(engine);
	// A retry sends the direction the maintainer reviewed earlier, not one reviewed against the task as it is now.
	function draft(changes: Partial<HandoffInput>) {
		const reviewed = setup.handoffDraft ? Effect.succeed(setup.handoffDraft) : handoffInput(served(engine).client);
		return Effect.map(reviewed, (input) => ({ ...input, ...changes }));
	}
	function changedRecord(line: string, paths: readonly string[], change: () => void) {
		tell(line);
		return changedOutside(engine, paths, change);
	}
	return {
		agentReportsReceipt: (state: string, extra = "") => {
			const record = projectPath(engine, RECORD);
			return changedRecord(`agent-codex edits ${RECORD} to report ${state}${extra ? ` and adds ${extra}` : ""}`, [RECORD], () => {
				const source = readFileSync(record, "utf8");
				if (!(source.includes("state: requested") && source.includes("\n---\n"))) {
					throw new Error(`${RECORD} no longer holds the requested receipt this verb rewrites`);
				}
				writeFileSync(
					record,
					source
						.replace("state: requested", `state: ${state}\n  by: agent-codex\n  note: Explicitly reported by the recipient.`)
						.replace("\n---\n", `\n${extra ? `${extra}\n` : ""}---\n`),
				);
			});
		},
		attemptHandoff: (changes: Partial<HandoffInput> = {}) => {
			tell(
				`the maintainer prepares handoff.keyboard.1${Object.keys(changes).length > 0 ? ` with a different ${Object.keys(changes).join(", ")}` : ""}`,
			);
			return Effect.flatMap(draft(changes), (input) => {
				const { client } = served(engine);
				return settledCall(() => client.mutate(client.handoffs.prepareHandoff.run(input)).then(() => "prepared"));
			});
		},
		copyHandoffRecord: (to: string) =>
			changedRecord(`an outside editor copies ${RECORD} to ${to}`, [to], () => {
				writeFileSync(projectPath(engine, to), readFileSync(projectPath(engine, RECORD)));
			}),
		handoffHistory: () => {
			tell("the maintainer reads task.keyboard's handoff history");
			const { client } = served(engine);
			return Effect.promise(async () => {
				const reading = await client.run(client.handoffs.handoffs.run({ item: "task.keyboard" }));
				return {
					records: reading.records.map(({ handoff, id }) => `${id} ${handoff.state}${handoff.by ? ` by ${handoff.by}` : ""}`),
					unreadable: [...reading.unknown],
				};
			});
		},
		handoffPage: () => {
			tell("the maintainer opens task.keyboard's handoff page");
			return Effect.promise(async () => {
				const page = markup(await renderRemaining(served(engine).board.url, "/_board/handoff?item=task.keyboard"));
				return {
					entries: [...page.querySelectorAll("article[data-receipt]")].map((entry) => ({
						copyPrompt: entry.querySelector("[data-handoff-copy]") !== null,
						id: entry.id,
						receipt: entry.getAttribute("data-receipt"),
						writtenFor:
							entry.querySelector("[data-current-source]")?.getAttribute("data-current-source") === "true" ? "current version" : "earlier version",
					})),
					notices: [...page.querySelectorAll('[data-slot="alert-description"]')].map(textIn),
				};
			});
		},
		handoffSourceFor: (item: string) => {
			tell(`the maintainer reviews ${item} as a handoff source`);
			const { client } = served(engine);
			return settledCall(() => client.run(client.handoffs.handoffSource.run({ item })).then((preview) => `${preview.item} from ${preview.source}`));
		},
		moveHandoffRecord: (to: string) =>
			changedRecord(`an outside editor moves ${RECORD} to ${to}`, [RECORD, to], () => {
				renameSync(projectPath(engine, RECORD), projectPath(engine, to));
			}),
		noteReadsSoFar: () => {
			tell("the reader notes the workspace files the board has read so far");
			return Effect.sync(() => {
				const files = [...(engine.reads?.files ?? [])];
				setup.readsNoted = files.length;
				return files;
			});
		},
		prepareHandoff: () => {
			tell("the maintainer prepares handoff.keyboard.1 for agent-codex");
			return Effect.flatMap(draft({}), (input) => {
				const { client } = served(engine);
				return Effect.promise((): Promise<Handoff> => client.mutate(client.handoffs.prepareHandoff.run(input)));
			});
		},
		promptedRecordFile: (prompt: string) => {
			tell("the reader finds the file the handoff prompt names");
			return Effect.sync(() => {
				const named = /"(?<path>[^"]+)"/u.exec(prompt)?.groups?.path;
				return named === undefined
					? "none"
					: relative(engine.notes.root, Schema.decodeUnknownSync(Schema.fromJsonString(Schema.String))(`"${named}"`));
			});
		},
		readsSinceNoted: () => {
			tell("the reader lists the distinct workspace files the board read since then");
			return Effect.sync(() => {
				if (!engine.reads || setup.readsNoted === undefined) {
					throw new Error("The story does not record workspace reads or never noted them; add recordedReads() and noteReadsSoFar()");
				}
				return [...new Set(engine.reads.files.slice(setup.readsNoted))].sort(Order.String);
			});
		},
		removeTaskSource: () =>
			changedRecord("an outside editor deletes items/keyboard.md", ["items/keyboard.md"], () => {
				rmSync(projectPath(engine, "items/keyboard.md"));
			}),
		reviewHandoff: () => {
			tell("the maintainer reviews task.keyboard and drafts handoff.keyboard.1 for agent-codex");
			return Effect.map(handoffInput(served(engine).client), (input) => {
				setup.handoffDraft = input;
			});
		},
	};
}
