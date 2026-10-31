import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { Conflict, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { fileUrl } from "#files/url.ts";
import { changedOutside } from "./publicationFaults.ts";
import { questionnaireAnswers } from "./questionnaire.ts";
import type { BoardEngine } from "./storyEngine.ts";
import { afterFrontMatter, workspaceReads } from "./workspaceReads.ts";

export function workspaceItemVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const { rpc, document, documentAt, saved } = workspaceReads(engine);
	return {
		diagnosedFiles: (files: readonly string[]) =>
			Effect.gen(function* () {
				tell("the reader opens each document and lists those the board reports problems for");
				const diagnosed: string[] = [];
				for (const file of files) {
					if ((yield* documentAt(fileUrl(file))).diagnostics.length > 0) {
						diagnosed.push(file);
					}
				}
				return diagnosed;
			}),
		documentBacklinks: (file: string) =>
			Effect.map(document(file), (read) => {
				tell(`the reader reads the backlinks of ${file}`);
				return (read.reading?.backlinks ?? []).map((link) => link.href);
			}),
		documentDiagnostics: (file: string) =>
			Effect.map(document(file), (read) => {
				tell(`the reader reads the diagnostics of ${file}`);
				return read.diagnostics;
			}),
		documentOwners: (files: readonly string[]) =>
			Effect.gen(function* () {
				tell("the reader reads the owner of each document, or the problems the board reports for it");
				const owners: Record<string, string> = {};
				for (const file of files) {
					const read = yield* documentAt(fileUrl(file));
					owners[file] =
						read.diagnostics.length > 0
							? `problems: ${read.diagnostics.map((problem) => problem.message).join("; ")}`
							: (read.metadata.owner ?? "no owner");
				}
				return owners;
			}),
		documentRead: (url: string) =>
			Effect.map(documentAt(url), (read) => {
				tell(`the reader reads ${url} through the board`);
				return read;
			}),
		documentReadFailure: (url: string) =>
			Effect.match(documentAt(url), {
				onFailure: (error) => {
					tell(`the reader tries to read ${url} through the board`);
					if (error instanceof NotFound) {
						return "not found";
					}
					return error instanceof Conflict ? "conflict" : `unexpected failure: ${String(error)}`;
				},
				onSuccess: () => {
					tell(`the reader tries to read ${url} through the board`);
					return "read";
				},
			}),
		documentSourceText: (file: string) =>
			Effect.map(document(file), (read) => {
				tell(`the reader reads the source the board serves for ${file}`);
				return read.source;
			}),
		editorAppends: (file: string, appended: string) =>
			Effect.sync(() => {
				tell(`an outside editor appends ${JSON.stringify(appended)} to ${file}`);
				appendFileSync(join(engine.notes.root, file), appended);
			}),
		itemDiagnostics: (url: string) =>
			Effect.map(documentAt(url), (read) => {
				tell(`the reader reads the problems the board reports for ${url}`);
				return read.diagnostics;
			}),
		itemMetadata: (url: string) =>
			Effect.map(documentAt(url), (read) => {
				tell(`the reader reads the metadata of ${url}`);
				return read.metadata;
			}),
		itemRelationships: (url: string) =>
			Effect.map(documentAt(url), (read) => {
				tell(`the reader reads the relationships of ${url}`);
				return (read.metadata.relationships ?? []).map((link) => `${link.kind} ${link.target}`);
			}),
		itemResponseAnswers: (url: string) =>
			Effect.map(documentAt(url), (read) => {
				tell(`the reader reads the answers recorded for the questions of ${url}`);
				return (read.requests ?? []).flatMap((request) => request.responses ?? []).flatMap((record) => record.response.answers ?? []);
			}),
		itemResponseBodies: (url: string) =>
			Effect.map(documentAt(url), (read) => {
				tell(`the reader reads the response texts recorded for ${url}`);
				return (read.requests ?? []).flatMap((request) => request.responses ?? []).map((record) => record.body);
			}),
		itemRulings: (url: string) =>
			Effect.map(documentAt(url), (read) => {
				tell(`the reader reads the standing rulings shown on ${url}`);
				return read.rulings;
			}),
		maintainerAnswers: (item: string, body: string) =>
			Effect.gen(function* () {
				tell(`the maintainer answers ${item} with ${JSON.stringify(body)}`);
				const question = yield* rpc((client) => client("work-board-responses.question", { item, request: "answer" }));
				yield* rpc((client) =>
					client("work-board-responses.answerQuestion", {
						author: "marvin",
						body,
						id: `answer.${item}`,
						item,
						request: "answer",
						revision: question.reviewedRevision,
						type: "answer",
					}),
				);
			}),
		outsideEditorSaves: (file: string, source: string) => {
			tell(`an outside editor saves ${file}, and the board's change feed names it`);
			return changedOutside(engine, [file], () => engine.notes.write(file, source));
		},
		pullRequestAddress: (file: string) =>
			Effect.map(document(file), (read) => {
				tell(`the reader reads the pull request address the board links from ${file}`);
				return read.pullRequests ?? "none";
			}),
		readerAnswers: (url: string, body: string) =>
			Effect.gen(function* () {
				tell(`the reader answers the open request on ${url} with ${JSON.stringify(body)}`);
				const preview = (yield* documentAt(url)).requests[0]?.preview;
				if (!preview) {
					throw new Error(`${url} has no open request to answer`);
				}
				const question = yield* rpc((client) =>
					client("work-board-responses.registerQuestion", { item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
				);
				yield* rpc((client) =>
					client("work-board-responses.recordResponse", {
						answers: questionnaireAnswers,
						author: "reader",
						body,
						id: "reply.reading",
						question: question.id,
						type: "answer",
					}),
				);
				return preview.reviewedRevision;
			}),
		savedBodies: (files: readonly string[]) =>
			Effect.sync(() => {
				tell("the reader reads the text after the front matter of each file on disk");
				return Object.fromEntries(files.map((file) => [file, afterFrontMatter(saved(file))]));
			}),
		savedFile: (file: string) =>
			Effect.sync(() => {
				tell(`the reader reads ${file} from disk`);
				return saved(file);
			}),
		savedFiles: (files: readonly string[]) =>
			Effect.sync(() => {
				tell(`the reader reads ${files.join(", ")} from disk`);
				return Object.fromEntries(files.map((file) => [file, saved(file)]));
			}),
		savedFilesMatching: (files: readonly string[], pattern: RegExp) =>
			Effect.sync(() => {
				tell(`the reader lists the files on disk that match ${pattern}`);
				return files.filter((file) => pattern.test(saved(file)));
			}),
		savedJsonFrontMatter: (file: string) =>
			Effect.sync(() => {
				tell(`the reader reads the JSON front matter of ${file} from disk`);
				return Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(saved(file).split("---")[1] ?? "");
			}),
	};
}
