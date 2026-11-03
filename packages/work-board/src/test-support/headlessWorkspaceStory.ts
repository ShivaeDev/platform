import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Exit, FileSystem, Layer, Path, PubSub, Scope } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Changes } from "#server/files/changes.ts";
import { Workspace } from "#server/workspace.ts";
import { workspaceLayer } from "#server/workspaceLayer.ts";
import { type Folder, folder } from "./board.ts";

interface Engine {
	changes?: Changes;
	readonly notes: Folder;
	output?: PubSub.Subscription<import("#server/files/changes.ts").Change>;
	scope?: Scope.Closeable;
	service?: typeof Workspace.Service;
	writable: boolean | undefined;
}

function started(engine: Engine) {
	if (!(engine.service && engine.scope && engine.changes && engine.output)) {
		throw new Error("The headless workspace has not started.");
	}
	return { changes: engine.changes, output: engine.output, scope: engine.scope, workspace: engine.service };
}

type WriteFailure = Effect.Error<ReturnType<(typeof Workspace.Service)["writeMetadata"]>>;

function writeOutcome<A>(effect: Effect.Effect<A, WriteFailure>) {
	return effect.pipe(
		Effect.as("saved"),
		Effect.catchTag("PreconditionFailed", (error) => Effect.succeed(`source changed: ${error.message}`)),
		Effect.catchTag("Forbidden", (error) => Effect.succeed(`writes disabled: ${error.message}`)),
		Effect.catchTag("BadRequest", (error) => Effect.succeed(`invalid metadata: ${error.message}`)),
	);
}

export const headlessWorkspaceStory = storyKit({
	after: {
		*project(engine: Engine) {
			engine.scope = yield* Scope.fork(yield* Scope.Scope);
			const context = yield* Layer.buildWithScope(
				workspaceLayer({ fleetPort: null, root: engine.notes.root, ...(engine.writable === undefined ? {} : { writable: engine.writable }) }),
				engine.scope,
			);
			engine.service = Context.get(context, Workspace);
			engine.changes = (yield* engine.service.settings()).changes;
			engine.output = yield* PubSub.subscribe(engine.changes.events);
		},
	},
	clock: "live",
	*create() {
		const notes = yield* Effect.acquireRelease(
			Effect.sync(() => folder({})),
			(acquired) => Effect.sync(acquired.remove),
		);
		const engine: Engine = { notes, writable: true };
		return engine;
	},
	inspect: (engine) => ({ root: engine.notes.root, writable: engine.writable }),
	layer: NodeServices.layer,
	name: "headless workspace",
	stages: ["project"],
	verbs: (engine, story) => ({
		archived: (selection: string) => {
			story.tell(`the application reads the archived snapshot for ${selection}`);
			return Effect.map(started(engine).workspace.archived(selection), (snapshot) =>
				snapshot.documents.map(({ file, parsed }) => ({ body: parsed.body, file, id: parsed.fields.id })),
			);
		},
		closeDecision: (source: string, request = "direction", nextAction?: string) => {
			story.tell(`the application closes decision ${request}`);
			return writeOutcome(
				started(engine).workspace.closeDecision({ file: "decision.md", ...(nextAction === undefined ? {} : { nextAction }), request, source }),
			);
		},
		document: (url: string) => {
			story.tell(`the application reads document ${url}`);
			return started(engine).workspace.document(url);
		},
		editorWrites: (file: string, source: string) =>
			Effect.sync(() => {
				story.tell(`an outside editor writes ${file}`);
				engine.notes.write(file, source);
			}),
		indexedFiles: () => {
			story.tell("the application lists the active index's files");
			return Effect.map(started(engine).workspace.index(), (snapshot) => snapshot.documents.map((document) => document.file));
		},
		metadata: (file = "task.md") => {
			story.tell(`the application reads metadata and source from ${file}`);
			return started(engine).workspace.metadata(file);
		},
		nextChangedPaths: () =>
			Effect.gen(function* () {
				story.tell("the application waits for the workspace's next indexed change");
				while (true) {
					const change = yield* PubSub.take(started(engine).output);
					if (change._tag === "Changed") {
						return change.paths;
					}
				}
			}),
		stop: () => {
			story.tell("the application closes the workspace scope");
			return Scope.close(started(engine).scope, Exit.void);
		},
		storedSource: (file = "task.md") =>
			Effect.gen(function* () {
				story.tell(`the application reads the stored bytes of ${file}`);
				return yield* (yield* FileSystem.FileSystem).readFileString((yield* Path.Path).join(engine.notes.root, file));
			}),
		watchingStopped: () => {
			story.tell("the application checks that the workspace change feed is closed");
			return PubSub.isShutdown(started(engine).changes.events);
		},
		writeMetadata: (source: string, fields: Readonly<Record<string, unknown>>, file = "task.md") => {
			story.tell(`the application writes metadata to ${file} against its reviewed source`);
			return writeOutcome(started(engine).workspace.writeMetadata({ fields, file, source }));
		},
	}),
});

export function workspaceFiles(files: Readonly<Record<string, string>>) {
	return headlessWorkspaceStory.trait("project", "the application opens these Markdown files", (engine) => {
		for (const [file, source] of Object.entries(files)) {
			engine.notes.write(file, source);
		}
	});
}

export const readOnlyWorkspace = headlessWorkspaceStory.trait("project", "the application leaves workspace writes disabled", (engine) => {
	engine.writable = undefined;
});
