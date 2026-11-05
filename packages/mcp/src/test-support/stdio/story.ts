import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect";
import { McpClient, McpProtocol } from "effect/ai";
import type { McpClientError } from "effect/ai/McpClientError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { connect, tool } from "#test/requests/client.ts";
import { startServer } from "#test/requests/startServer.ts";
import { ResourceAnswer, ResourceFile, resourceTools } from "./tools.ts";

const start = Effect.fnUntraced(function* (protocol: typeof McpProtocol.v2025_11_25 | typeof McpProtocol.v2026_07_28) {
	const directory = yield* Effect.acquireRelease(
		Effect.promise(() => mkdtemp(join(tmpdir(), "mcp-stdio-"))),
		(temporary) => Effect.promise(() => rm(temporary, { force: true, recursive: true })),
	);
	const file = join(directory, "resource.txt");
	yield* Effect.promise(() => writeFile(file, "resource contents"));
	const scope = yield* Scope.make();
	yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const spawned = yield* Deferred.make<ChildProcessSpawner.ChildProcessHandle>();
	const observed = ChildProcessSpawner.make((command) => spawner.spawn(command).pipe(Effect.tap((child) => Deferred.succeed(spawned, child))));
	const client = yield* McpClient.make({ name: "Resource client", version: "1" }).pipe(
		Effect.provideServiceEffect(
			McpClient.Transport,
			McpClient.stdio({
				command: ChildProcess.make(process.execPath, [
					"--conditions=@shivaedev/source",
					fileURLToPath(new URL("./process.ts", import.meta.url)),
					file,
				]),
				protocol,
			}),
		),
		Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, observed),
		Effect.provideService(Scope.Scope, scope),
	);
	return { child: yield* Deferred.await(spawned), client, file, scope };
});

type Engine = Effect.Success<ReturnType<typeof start>>;

const definition = {
	inspect: (engine: Engine) => ({ resource: engine.file }),
	layer: NodeServices.layer,
	name: "MCP tools over stdio",
	stages: [],
	verbs: (engine: Engine, story: { readonly tell: (line: string) => void }) => {
		let pending: Fiber.Fiber<typeof ResourceAnswer.Type, McpClientError> | undefined;
		return {
			cancelCall: () => {
				story.tell("the client cancels its in-flight tool call");
				return pending === undefined ? Effect.die("Start the resource call first") : Fiber.interrupt(pending).pipe(Effect.asVoid);
			},
			close: () => {
				story.tell("the client closes its stdio connection");
				return Scope.close(engine.scope, Exit.void);
			},
			definitions: () => engine.client.listTools(),
			exitStatus: () => engine.child.exitCode.pipe(Effect.map((code) => (Number(code) === 130 ? "interrupted" : `exited ${code}`))),
			httpDefinitions: () =>
				Effect.gen(function* () {
					const url = yield* startServer(resourceTools.pipe(Layer.provide(Layer.succeed(ResourceFile, engine.file))));
					const client = yield* connect(url, "alice");
					return yield* client.listTools();
				}),
			readResource: () => {
				story.tell("the client calls readResource");
				return engine.client.callTool({ schema: ResourceAnswer, tool: tool("readResource") }).pipe(Effect.map(({ text }) => text));
			},
			resourceState: (released: boolean) =>
				engine.client.callTool({ arguments: { released }, schema: ResourceAnswer, tool: tool("resourceState") }).pipe(Effect.map(({ text }) => text)),
			serverIsRunning: () => engine.child.isRunning,
			startResourceCall: () =>
				Effect.gen(function* () {
					story.tell("the client starts holdResource");
					pending = yield* engine.client.callTool({ schema: ResourceAnswer, tool: tool("holdResource") }).pipe(Effect.forkScoped);
				}),
			storedRelease: () => Effect.promise(() => readFile(`${engine.file}.released`, "utf8")),
			tools: () => Effect.map(engine.client.listTools(), (tools) => tools.map(({ name }) => name)),
		};
	},
};

export const stdioStory = storyKit({ ...definition, create: () => start(McpProtocol.v2025_11_25) });
export const modernStdioStory = storyKit({ ...definition, create: () => start(McpProtocol.v2026_07_28) });
