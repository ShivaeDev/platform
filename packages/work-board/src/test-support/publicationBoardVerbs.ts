import { readdirSync, readFileSync } from "node:fs";
import { Effect, Fiber, Order } from "effect";
import { browserClient } from "#browserClient.ts";
import { publish } from "#server/responses/publish.ts";
import { publishIn } from "#server/responses/publishIn.ts";
import type { RunningBoard } from "./board.ts";
import { distinctVerbs } from "./distinctVerbs.ts";
import { embeddedBoard } from "./embeddedBoard.ts";
import { handoffVerbs } from "./handoffVerbs.ts";
import { changesUntil, type EventStream, subscribe } from "./nativeRpc.ts";
import { entriesOf, projectPath, publicationSetup, textOf } from "./publicationFaults.ts";
import { refusal, settledCall, settledEffect } from "./responseOutcome.ts";
import { resultReviewVerbs } from "./resultReviewVerbs.ts";
import { socketStartup } from "./socketStartup.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

type Client = ReturnType<typeof browserClient>;
const DIRECTION = { item: "task.choice", request: "direction" };

export function publicationBoardVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const setup = publicationSetup(engine);
	const boards = new Map<string, { board: RunningBoard; client: Client }>();
	const root = engine.notes.root;
	function named(name: string) {
		const board = boards.get(name);
		if (!board) {
			throw new Error(`No board named ${name} is serving the project`);
		}
		return board.client;
	}
	async function answerWith(client: Client, id: string, body: string) {
		const preview = await client.run(client.responses.question.run(DIRECTION));
		return client.mutate(
			client.responses.answerQuestion.run({ ...DIRECTION, author: "maintainer", body, id, revision: preview.reviewedRevision, type: "answer" }),
		);
	}
	const publication = {
		answerDirection: (id: string, body: string) => {
			tell(`the maintainer answers task.choice/direction with ${id}`);
			return Effect.promise(() => answerWith(served(engine).client, id, body));
		},
		boardKilledWhilePublishing: Effect.fn("Story.boardKilledWhilePublishing")(function* (phase: "temporary" | "published", body: string) {
			tell(`a Board process publishing the maintainer's response.restart is killed right after it writes the ${phase} file`);
			const process = yield* socketStartup(root, phase, new URL("./answerPublicationChild.ts", import.meta.url));
			const ready = yield* process.next();
			if (ready.url === undefined) {
				return yield* Effect.die(new Error("The Board process has no listener"));
			}
			const client = browserClient(ready.url);
			const saving = answerWith(client, "response.restart", body).catch((error: unknown) => error);
			const reached = yield* process.next();
			if (reached.phase !== phase) {
				return yield* Effect.die(new Error(`The Board process paused at ${reached.phase} instead of ${phase}`));
			}
			yield* process.kill;
			yield* Effect.promise(() => saving);
			client.registry.dispose();
		}),
		directionHistory: () => {
			tell("the maintainer reads the recorded answers to task.choice/direction");
			const client = served(engine).client;
			return Effect.promise(async () => {
				const preview = await client.run(client.responses.question.run(DIRECTION));
				return (await client.run(client.responses.responses.run({ question: preview.id }))).responses;
			});
		},
		fileText: (path: string) => {
			tell(`the reader reads ${path} from disk`);
			return Effect.sync(() => textOf(projectPath(engine, path)));
		},
		folderEntries: (path: string) => {
			tell(`the reader lists ${path} on disk`);
			return Effect.sync(() => entriesOf(projectPath(engine, path)));
		},
		outsideFileText: (name: string) => {
			tell(`the reader reads ${name} in the other folder`);
			return Effect.sync(() => (setup.outside ? textOf(`${setup.outside.root}/${name}`) : "missing"));
		},
		outsideFolderEntries: () => {
			tell("the reader lists the other folder");
			return Effect.sync(() => (setup.outside ? entriesOf(setup.outside.root) : "missing"));
		},
		publishConcurrently: (id: string, contents: readonly string[]) => {
			tell(`${contents.length} writers publish ${id} at once`);
			return Effect.all(
				contents.map((content) => settledEffect(Effect.as(publish(root, root, id, content), "published"))),
				{ concurrency: "unbounded" },
			).pipe(Effect.map((results) => [...results].sort(Order.String)));
		},
		publishIntoOpenFolder: (id: string, content: string) => {
			tell(`the writer publishes ${id} into the responses/ it opened`);
			const folder = setup.folder;
			if (!folder) {
				throw new Error("No writer has opened responses/; add responsesFolderOpen()");
			}
			return settledCall(() => publishIn(folder, root, root, id, content).then(() => "published"));
		},
		publishRecord: (id: string, content: string) => {
			tell(`a writer publishes ${id}`);
			return settledEffect(Effect.as(publish(root, root, id, content), "published"));
		},
		recordOn: (name: string, question: string, body: string) => {
			tell(`the reviewer records response.concurrent through the ${name} board`);
			const client = named(name);
			return settledCall(() =>
				client.mutate(client.responses.recordResponse.run({ author: "reviewer", body, id: "response.concurrent", question, type: "answer" })),
			);
		},
		recordOnBoardsAtOnce: (question: string, bodies: Readonly<Record<string, string>>) => {
			tell(`the reviewer records response.concurrent through ${Object.keys(bodies).join(" and ")} at once`);
			return Effect.promise(() =>
				Promise.all(
					Object.entries(bodies).map(([name, body]) => {
						const client = named(name);
						return client
							.mutate(client.responses.recordResponse.run({ author: "reviewer", body, id: "response.concurrent", question, type: "answer" }))
							.then(() => "recorded", refusal);
					}),
				).then((results) => results.sort(Order.String)),
			);
		},
		registerDirectionOn: Effect.fn("Story.registerDirectionOn")(function* (name: string) {
			tell(`the reviewer registers task.choice/direction through the ${name} board, and the other boards index the question`);
			const client = named(name);
			const others: { readonly client: Client; readonly events: EventStream }[] = [];
			for (const [other, running] of boards) {
				if (other !== name) {
					const events = yield* subscribe(running.board);
					yield* events.next();
					others.push({ client: running.client, events });
				}
			}
			const question = yield* Effect.promise(async () => {
				const preview = await client.run(client.responses.question.run(DIRECTION));
				return client.mutate(client.responses.registerQuestion.run({ ...DIRECTION, revision: preview.reviewedRevision }));
			});
			for (const other of others) {
				const shown = Effect.promise(() =>
					other.client.run(other.client.responses.responses.run({ question: question.id })).then(
						() => true,
						() => false,
					),
				);
				while (!(yield* shown)) {
					yield* changesUntil(other.events, `responses/${question.id}.md`);
				}
				yield* other.events.close();
			}
			return question;
		}),
		responseFilesOnDisk: () => {
			tell("the reader lists the response files on disk");
			return Effect.sync(() => {
				const listed = entriesOf(projectPath(engine, "responses"));
				return listed === "missing" ? [] : listed.filter((name) => name.startsWith("response."));
			});
		},
		responsesOn: (name: string, question: string) => {
			tell(`the reviewer reads the recorded responses through the ${name} board`);
			const client = named(name);
			return Effect.promise(async () => (await client.run(client.responses.responses.run({ question }))).responses.map(({ body }) => body));
		},
		shutDownBoard: Effect.fn("Story.shutDownBoard")(function* () {
			tell("the Board shuts down while the accepted answer save waits");
			const held = setup.heldSave;
			if (!(held && setup.answer)) {
				throw new Error("No answer save is in flight; add answerSavesWaitAtSourceRead() and startDirectionAnswer()");
			}
			const stopping = yield* Effect.forkChild(served(engine).board.stop());
			yield* Effect.promise(() => setup.answer ?? Promise.resolve());
			held.release();
			yield* Fiber.join(stopping);
		}),
		startBoardNamed: Effect.fn("Story.startBoardNamed")(function* (name: string) {
			tell(`the ${name} board starts serving the project with responses enabled`);
			const board = yield* embeddedBoard(root, true);
			const client = browserClient(board.url);
			yield* Effect.addFinalizer(() => Effect.sync(() => client.registry.dispose()));
			boards.set(name, { board, client });
		}),
		startDirectionAnswer: (id: string, body: string) => {
			tell(`the maintainer starts saving ${id} for task.choice/direction`);
			const client = served(engine).client;
			return Effect.promise(async () => {
				setup.answer = answerWith(client, id, body).catch((error: unknown) => error);
				await setup.heldSave?.started;
			});
		},
		stopNamedBoards: Effect.fn("Story.stopNamedBoards")(function* () {
			tell(`the ${[...boards.keys()].join(" and ")} boards stop`);
			for (const { board } of boards.values()) {
				yield* board.stop();
			}
			boards.clear();
		}),
		temporaryRecordTexts: () => {
			tell("the reader reads the temporary files left in responses/");
			return Effect.sync(() =>
				readdirSync(projectPath(engine, "responses"))
					.filter((name) => name.endsWith(".tmp"))
					.map((name) => readFileSync(projectPath(engine, `responses/${name}`), "utf8")),
			);
		},
	};
	return distinctVerbs(publication, handoffVerbs(engine, tell), resultReviewVerbs(engine, tell));
}
