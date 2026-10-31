import { readFileSync } from "node:fs";
import { Deferred, Effect, Order } from "effect";
import { createResponse } from "#client/react/createResponse.ts";
import { fileUrl } from "#files/url.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { rawPost } from "./board.ts";
import { changesUntil, subscribe } from "./nativeRpc.ts";
import { publicationSetup } from "./publicationFaults.ts";
import { described, questionRecordReads, type Reply } from "./questionRecordReads.ts";
import { type Registration, registeredQuestion } from "./questionRecordState.ts";
import { settledCall } from "./responseOutcome.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function questionRecordVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const { records, client, path, draft, reading } = questionRecordReads(engine);
	return {
		answerActions: (file: string) => {
			tell(`the reader reads the answer actions the board offers in ${file}`);
			return Effect.promise(async () => Object.keys((await client().run(client().api.document.run({ url: fileUrl(file) }))).questionActions));
		},
		answerFromBrowser: (id: string, body: string) => {
			tell(`the maintainer answers task.choice/direction with ${id} from the item page, and the board indexes the saved reply`);
			return Effect.gen(function* () {
				const events = yield* subscribe(served(engine).board);
				yield* events.next();
				yield* Effect.promise(async () => {
					const preview = await client().run(client().responses.question.run({ item: "task.choice", request: "direction" }));
					records.readMark = engine.reads?.files.length ?? 0;
					await client().mutate(
						createResponse(client(), preview, {
							author: "maintainer",
							body,
							id,
							question: preview.id,
							revision: preview.reviewedRevision,
							type: "answer",
						}),
					);
				});
				yield* changesUntil(events, `responses/${id}.md`);
				yield* events.close();
			});
		},
		browserLeaves: () => {
			tell("the maintainer closes the page while the save waits, and the board lets go of the request");
			const leaving = records.leaving;
			const ended = records.answerRequestEnded;
			if (!(leaving && ended)) {
				throw new Error("No browser save is in flight; add answerRequestsTraced() and call browserStartsAnswer()");
			}
			leaving.abort();
			return Effect.promise(() => leaving.settled).pipe(Effect.andThen(Deferred.await(ended)));
		},
		browserStartsAnswer: (id: string, body: string) => {
			tell(`the maintainer starts saving ${id} for task.choice/direction from the item page`);
			const held = publicationSetup(engine).heldSave;
			if (!held) {
				throw new Error("No save is held; add answerSavesWaitAtSourceRead()");
			}
			return Effect.promise(async () => {
				const preview = await client().run(client().responses.question.run({ item: "task.choice", request: "direction" }));
				const controller = new AbortController();
				const settled = client()
					.mutate(
						createResponse(client(), preview, {
							author: "maintainer",
							body,
							id,
							question: preview.id,
							revision: preview.reviewedRevision,
							type: "answer",
						}),
						controller.signal,
					)
					.catch((error: unknown) => error);
				records.leaving = { abort: () => controller.abort(), settled };
				await held.started;
			});
		},
		documentRequests: (file: string) => {
			tell(`the reader reads the requests the board shows on ${file}`);
			return settledCall(async () =>
				(await client().run(client().api.document.run({ url: fileUrl(file) }))).requests.map(({ id, open, unavailable }) => ({
					id,
					open,
					unavailable,
				})),
			);
		},
		filesReadSinceAnswer: () => {
			tell("the reader lists the workspace files the board read since the answer was sent");
			if (!engine.reads || records.readMark === undefined) {
				throw new Error("No answer was sent while the board recorded its reads");
			}
			return Effect.succeed([...new Set(engine.reads.files.slice(records.readMark))].sort(Order.String));
		},
		nextReply: (after?: string) => {
			tell(`the reader asks for the next reply${after ? ` after ${after}` : ""}`);
			const question = registeredQuestion(engine).id;
			return settledCall(async () => (await client().run(client().responses.awaitResponse.run({ after, question }))).response?.id ?? "none");
		},
		postPlainTextToRpc: () => {
			tell("a page on the board's own origin posts a plain-text form to the RPC endpoint");
			const { board } = served(engine);
			return Effect.map(rawPost(board, "/_board/rpc", { "content-type": "text/plain", origin: board.url }, "{}"), ({ status }) => status);
		},
		promptRequirements: (file: string) => {
			tell(`the reader reads which prompts in ${file} require a choice`);
			return Effect.promise(async () =>
				(await client().read(client().api.board.query({ url: fileUrl(file) }))).document.requests.flatMap((request) =>
					(request.prompts ?? []).map((prompt) => `${prompt.id}: ${prompt.requireSelection ? "choice required" : "choice optional"}`),
				),
			);
		},
		questionPreview: (item: string, request: string) => {
			tell(`the reader asks the board for the question ${item}/${request}`);
			return settledCall(async () => {
				const preview = await client().run(client().responses.question.run({ item, request }));
				return `${preview.item}/${preview.request}`;
			});
		},
		recordedReply: (id: string) => {
			tell(`the reader reads ${id} among the replies to the registered question`);
			return Effect.map(reading(), (result) => {
				const reply = typeof result === "string" ? undefined : result.responses.find((entry) => entry.id === id);
				return reply ? { body: reply.body, supersedes: reply.response.supersedes, type: reply.response.type } : "not recorded";
			});
		},
		recordReply: (reply: Reply = {}) => {
			tell(`the maintainer records ${described(reply)}${reply.body ? `: ${reply.body}` : ""}`);
			return settledCall(() => client().mutate(client().responses.recordResponse.run(draft(reply))));
		},
		registerQuestion: (item = "investigation.choices", request = "direction") => {
			tell(`the reader registers ${item}/${request} against its reviewed source`);
			return settledCall(async () => {
				const preview = await client().run(client().responses.question.run({ item, request }));
				const question = await client().mutate(client().responses.registerQuestion.run({ item, request, revision: preview.reviewedRevision }));
				records.questions.push(question);
				return question;
			});
		},
		registerWithEarlierRevision: () => {
			const { question } = registeredQuestion(engine);
			tell(`the reader registers ${question.item}/${question.request} against the revision it reviewed earlier`);
			return settledCall(() =>
				client().mutate(
					client().responses.registerQuestion.run({ item: question.item, request: question.request, revision: question.reviewedRevision }),
				),
			);
		},
		repliesToIdentity: (id: string) => {
			tell(`the reader reads the replies to ${id} as if it were a registered question`);
			return Effect.map(
				settledCall(() => client().run(client().responses.responses.run({ question: id }))),
				(result) => (typeof result === "string" ? result : result.responses.map((reply) => reply.id)),
			);
		},
		replyHistory: (question: Registration = "current") => {
			tell(`the reader reads the replies to the ${question === "current" ? "registered" : "earlier registered"} question`);
			return Effect.map(reading(question), (result) => (typeof result === "string" ? result : result.responses.map(({ id }) => id)));
		},
		respondPageFormPolicy: () => {
			tell("a browser opens the respond page for investigation.model/review-model");
			return Effect.promise(async () =>
				(
					(await fetch(`${served(engine).board.url}/_board/respond?item=investigation.model&request=review-model`)).headers.get(
						"content-security-policy",
					) ?? ""
				)
					.split(";")
					.map((directive) => directive.trim())
					.filter((directive) => directive.startsWith("form-action")),
			);
		},
		savedAnswers: (id: string) => {
			tell(`the reader reads the answers stored in responses/${id}.md`);
			return Effect.sync(() => metadataParse(readFileSync(path(`responses/${id}.md`), "utf8")).fields.response?.answers);
		},
	};
}
