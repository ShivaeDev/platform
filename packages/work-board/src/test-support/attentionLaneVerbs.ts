import { existsSync, readdirSync, readFileSync, renameSync, statSync, utimesSync } from "node:fs";
import { join, relative } from "node:path";
import { Effect, Order } from "effect";
import type { InboxProjection } from "#browser/views/schema.ts";
import { fileUrl } from "#files/url.ts";
import { needsYou } from "#server/mcp/queries.ts";
import { identityUrl } from "#server/metadata/links.ts";
import { runArchive, standingPolicyAnswer } from "./attentionLaneActions.ts";
import { rawGet } from "./board.ts";
import { changesUntil, rpcCall, subscribe } from "./nativeRpc.ts";
import { startProject } from "./servingEngine.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

type Lane = "agents" | "answered" | "parked" | "resolved" | "you";
const DAY_SECONDS = 24 * 60 * 60;

function markdownUnder(root: string, folder: string): string[] {
	const start = join(root, folder);
	if (!existsSync(start)) {
		return [];
	}
	return readdirSync(start, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

export function attentionLaneVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function inbox() {
		return rpcCall(served(engine).board, (client) => client("work-board.inbox", undefined));
	}
	function lane(projection: InboxProjection, name: Lane) {
		return projection[name];
	}
	function document(id: string) {
		const { client } = served(engine);
		return Effect.promise(() => client.run(client.api.document.run({ url: identityUrl(id) })));
	}
	function waitingFor(path: string, change: () => void) {
		return Effect.gen(function* () {
			const events = yield* subscribe(served(engine).board);
			// The first hint is the server's Resync, sent once the subscription listens.
			yield* events.next();
			change();
			yield* changesUntil(events, path);
			yield* events.close();
		});
	}
	return {
		ageBriefs: (files: readonly string[], days: number) => {
			tell(`an outside process dates ${files.join(" and ")} ${days} days back and the board re-reads them`);
			return waitingFor(files.at(-1) ?? "", () => {
				for (const file of files) {
					const path = join(engine.notes.root, file);
					const time = statSync(path).mtimeMs / 1000 - days * DAY_SECONDS;
					utimesSync(path, time, time);
				}
			});
		},
		answerStandingPolicy: () => {
			tell("the maintainer answers the standing release policy After review through Board");
			return standingPolicyAnswer(engine);
		},
		answersOf: (id: string) => {
			tell(`the reader reads the recorded answers on ${id}`);
			return Effect.map(document(id), (read) =>
				read.requests.flatMap((request) => request.responses ?? []).map((response) => ({ body: response.body, id: response.id })),
			);
		},
		archivePass: () => {
			tell("the archive command runs on the workspace");
			return Effect.sync(() => runArchive(engine).trim());
		},
		boardStarts: () => {
			tell("the board starts and indexes the project");
			return Effect.gen(function* () {
				yield* startProject(engine, { fleetPort: null });
				const { client } = served(engine);
				yield* Effect.promise(() => client.run(client.api.goals.run()));
			});
		},
		briefFiles: () => {
			tell("the reader lists the active and archived briefs");
			return Effect.sync(() => [...markdownUnder(engine.notes.root, "tasks"), ...markdownUnder(engine.notes.root, "archive")].sort(Order.String));
		},
		briefMoved: (from: string, to: string) => {
			tell(`an outside editor moves ${from} to ${to} and the board re-reads it`);
			return waitingFor(to, () => renameSync(join(engine.notes.root, from), join(engine.notes.root, to)));
		},
		briefStatus: (id: string) => {
			tell(`the reader reads the status of ${id}`);
			return Effect.map(document(id), (read) => read.metadata.status);
		},
		clearRecordedReads: () => {
			tell("the reader notes only the files the board reads from here on");
			return Effect.sync(() => {
				if (!engine.reads) {
					throw new Error("The story does not record workspace reads");
				}
				engine.reads.files.length = 0;
			});
		},
		decisionRequests: (id: string) => {
			tell(`the reader reads the open requests and answers shown on ${id}`);
			return Effect.map(document(id), (read) => read.requests.filter((request) => request.open).map((request) => [request.id, request.answered]));
		},
		dependencyOn: (id: string, target: string) => {
			tell(`the reader reads how ${id} shows its dependency on ${target}`);
			return Effect.map(document(id), (read) => ({ diagnostics: read.diagnostics, target: read.referenceDetails?.[target] }));
		},
		foundAt: (id: string) => {
			tell(`the reader looks up ${id} by its identity`);
			return Effect.map(document(id), (read) => read.file);
		},
		goalProgress: () => {
			tell("the reader reads goal progress");
			const { client } = served(engine);
			return Effect.promise(() => client.run(client.api.goals.run())).pipe(
				Effect.map((data) => data.goals.map((goal) => ({ counts: goal.counts, linked: goal.linked }))),
			);
		},
		hiddenFleetRecords: () => {
			tell("the reader reads how many Fleet records the library hides");
			return rpcCall(served(engine).board, (client) => client("work-board.library", {})).pipe(Effect.map((data) => data.fleetCount));
		},
		idDiagnostics: (file: string) => {
			tell(`the reader reads the identity diagnostics of ${file}`);
			const { client } = served(engine);
			return Effect.promise(() => client.run(client.api.document.run({ url: fileUrl(file) }))).pipe(
				Effect.map((read) => read.diagnostics.filter((diagnostic) => diagnostic.field === "id").map((diagnostic) => diagnostic.message)),
			);
		},
		inboxAnswers: () => {
			tell("the reader reads the Answered lane");
			return Effect.map(inbox(), (projection) => projection.answered.map((row) => ({ answered: row.answered, id: row.id })));
		},
		inboxAsk: (id: string, from: Lane = "you") => {
			tell(`the reader reads the ${from} row for ${id}`);
			return Effect.map(inbox(), (projection) => {
				const row = lane(projection, from).find((entry) => entry.id === id);
				return row && { earlierAsks: row.earlierAsks, href: row.href, reason: row.reason, ...(row.problem ? { problem: row.problem } : {}) };
			});
		},
		inboxComplete: () => {
			tell("the reader reads whether the inbox saw the whole workspace");
			return Effect.map(inbox(), (projection) => projection.complete);
		},
		inboxLane: (name: Lane) => {
			tell(`the reader reads the ${name} lane of the inbox`);
			return Effect.map(inbox(), (projection) => lane(projection, name).map((row) => row.id));
		},
		inboxLaneSources: (name: Lane) => {
			tell(`the reader reads the source files of the ${name} lane`);
			return Effect.map(inbox(), (projection) => lane(projection, name).map((row) => row.file));
		},
		inboxProblems: () => {
			tell("the reader reads the problems shown on asks waiting on you");
			return Effect.map(inbox(), (projection) =>
				projection.you.filter((row) => row.problem).map((row) => ({ href: row.href, id: row.id, problem: row.problem })),
			);
		},
		inboxResponders: () => {
			tell("the reader reads who each agent ask waits on");
			return Effect.map(inbox(), (projection) => projection.agents.map((row) => [row.id, row.responseFrom]));
		},
		itemLink: (id: string) => {
			tell(`a reader opens the item link of ${id}`);
			return Effect.map(rawGet(served(engine).board, `/_board/item/${id}/`), (response) => `HTTP ${response.status}`);
		},
		libraryFiles: (showFleet: boolean) => {
			tell(showFleet ? "the reader lists the library with Fleet records shown" : "the reader lists the library");
			return rpcCall(served(engine).board, (client) => client("work-board.library", { showFleet })).pipe(
				Effect.map((data) => data.files.map((file) => file.path)),
			);
		},
		needsYouBadge: () => {
			tell("the reader reads the Inbox badge");
			return rpcCall(served(engine).board, (client) => client("work-board.navigation", { current: "" })).pipe(Effect.map((data) => data.inboxCount));
		},
		needsYouTool: () => {
			tell("the agent reads the needs_you plugin tool");
			return Effect.map(rpcCall(served(engine).board, needsYou), (result) => result.you.map((row) => [row.id, row.reason]));
		},
		recentAnswers: () => {
			tell("the maintainer reads the recent answers on Today");
			return Effect.map(inbox(), (projection) => projection.recent.map((row) => ({ answer: row.answer, id: row.id, state: row.state })));
		},
		recordedReadsUnder: (folder: string) => {
			tell(`the reader reads which files under ${folder} the board read`);
			return Effect.sync(() => {
				if (!engine.reads) {
					throw new Error("The story does not record workspace reads");
				}
				return engine.reads.files.filter((file) => file.startsWith(`${folder}/`) && file.endsWith(".md"));
			});
		},
		recordsWritten: (files: Readonly<Record<string, string>>) => {
			const paths = Object.keys(files);
			tell(`Fleet writes ${paths.join(", ")} and the board re-reads them`);
			return waitingFor(paths.at(-1) ?? "", () => {
				for (const [path, source] of Object.entries(files)) {
					engine.notes.write(path, source);
				}
			});
		},
		settledStore: () => {
			tell("the reader reads the settled records the archive keeps");
			return Effect.sync(
				(): Readonly<Record<string, string | undefined>> =>
					Object.fromEntries(
						markdownUnder(engine.notes.root, ".board-settled").map((file) => [
							file.slice(".board-settled/".length, -".md".length),
							readFileSync(join(engine.notes.root, file), "utf8"),
						]),
					),
			);
		},
		sourceProblems: () => {
			tell("the reader reads the source problems reported beside the inbox");
			return Effect.map(inbox(), (projection) => projection.issues.map((issue) => ({ file: issue.file, message: issue.message })));
		},
		sourcesAt: (files: readonly string[]) => {
			tell(`the reader reads ${files.join(", ")}`);
			return Effect.sync(
				(): Readonly<Record<string, string | undefined>> =>
					Object.fromEntries(
						files.map((file) => {
							const path = join(engine.notes.root, file);
							return [file, existsSync(path) ? readFileSync(path, "utf8") : "missing"];
						}),
					),
			);
		},
		todayNeedsYou: () => {
			tell("the maintainer reads Needs you on Today");
			return Effect.map(inbox(), (projection) => projection.you.map((row) => [row.id, row.reason]));
		},
	};
}
