import { chmodSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { Clock, Effect } from "effect";
import { Responses } from "#server/Responses.ts";
import { questionMarkdown, responseMarkdown } from "#server/responses/records.ts";
import { changesUntil, subscribe } from "./nativeRpc.ts";
import { publicationSetup } from "./publicationFaults.ts";
import { questionRecordReads } from "./questionRecordReads.ts";
import { registeredQuestion } from "./questionRecordState.ts";
import { largeQuestion, recordedEdgeResponse } from "./responseEdges.ts";
import { settledEffect } from "./responseOutcome.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function questionEditorVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const { records, path, outside, questionFile, service } = questionRecordReads(engine);
	return {
		heldSaveContinues: (id: string) => {
			tell(`the held save continues and the board publishes responses/${id}.md`);
			const held = publicationSetup(engine).heldSave;
			if (!held) {
				throw new Error("No save is held; add answerSavesWaitAtSourceRead()");
			}
			return Effect.gen(function* () {
				const events = yield* subscribe(served(engine).board);
				yield* events.next();
				held.release();
				yield* changesUntil(events, `responses/${id}.md`);
				yield* events.close();
			});
		},
		historyBeforeServing: () => {
			tell("the response service reads the history of investigation.choices/direction while the board indexes the workspace");
			const preview = {
				context: "",
				id: "question.history",
				item: "investigation.choices",
				reason: "Choose.",
				request: "direction",
				reviewedRevision: "0".repeat(64),
				source: "decision.md",
			};
			return settledEffect(Effect.flatMap(Responses, (responses) => responses.history(preview)).pipe(Effect.provide(service)));
		},
		outsideEditorCopiesQuestionRecord: (to: string) => {
			tell(`an outside editor copies the registered question's record to ${to}`);
			const source = readFileSync(path(questionFile()), "utf8");
			return outside([to], () => engine.notes.write(to, source));
		},
		outsideEditorExpiresQuestion: () => {
			tell("an outside editor moves the registered question's deadline into the past");
			const question = registeredQuestion(engine);
			return Effect.flatMap(Clock.currentTimeMillis, (now) => {
				const expired = { ...question, question: { ...question.question, deadline: now - 1000, registeredAt: now - 48 * 60 * 60 * 1000 - 1000 } };
				return outside([questionFile()], () => engine.notes.write(questionFile(), questionMarkdown(expired)));
			});
		},
		outsideEditorMoves: (from: string, to: string) => {
			tell(`an outside editor moves ${from} to ${to}`);
			return outside([from, to], () => renameSync(path(from), path(to)));
		},
		outsideEditorMovesQuestionRecord: (to: string) => {
			tell(`an outside editor moves the registered question's record to ${to}`);
			const from = questionFile();
			return outside([from, to], () => renameSync(path(from), path(to)));
		},
		outsideEditorRemoves: (file: string) => {
			tell(`an outside editor deletes ${file}`);
			return outside([file], () => unlinkSync(path(file)));
		},
		outsideEditorWrites: (file: string, source: string) => {
			tell(`an outside editor writes ${file}`);
			return outside([file], () => engine.notes.write(file, source));
		},
		outsideWriterAddsOversizedQuestion: () => {
			tell("an outside writer adds a registered question whose context exceeds 256 KiB");
			const question = largeQuestion(registeredQuestion(engine));
			const file = `responses/${question.id}.md`;
			return Effect.andThen(
				outside([file], () => engine.notes.write(file, questionMarkdown(question))),
				Effect.sync(() => {
					records.questions.push(question);
				}),
			);
		},
		outsideWriterAddsReply: (file: string, id: string, body = "Review the context.") => {
			tell(`an outside writer adds reply ${id} to the registered question as ${file}`);
			const record = { ...recordedEdgeResponse(registeredQuestion(engine), body), id };
			return outside([file], () => engine.notes.write(file, responseMarkdown(record)));
		},
		sourceBecomesUnreadable: (file: string) => {
			tell(`${file} stops being readable`);
			return Effect.acquireRelease(
				outside([file], () => chmodSync(path(file), 0o000)),
				() => Effect.sync(() => chmodSync(path(file), 0o644)),
			);
		},
	};
}
