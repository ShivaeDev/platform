import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Deferred, Effect, Fiber, Queue, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { call, connect, tool } from "./client.ts";
import { startServer } from "./startServer.ts";
import { CallerAnswer, requestTools } from "./tools.ts";

const start = Effect.fnUntraced(function* () {
	const directory = yield* Effect.acquireRelease(
		Effect.promise(() => mkdtemp(join(tmpdir(), "mcp-resource-"))),
		(temporary) => Effect.promise(() => rm(temporary, { force: true, recursive: true })),
	);
	const file = join(directory, "resource.txt");
	yield* Effect.promise(() => writeFile(file, "resource contents"));
	const tools = yield* requestTools(file);
	const first = yield* startServer(tools.tools);
	const second = yield* startServer(tools.otherTools);
	const clients = {
		alice: yield* connect(first, "alice"),
		bob: yield* connect(first, "bob"),
		second: yield* connect(second, "alice"),
	};
	return { ...tools, clients };
});

type Engine = Effect.Success<ReturnType<typeof start>>;
type Person = "alice" | "bob";

export const requestsStory = storyKit({
	clock: "live",
	create: start,
	name: "MCP request isolation over HTTP",
	stages: [],
	verbs: (engine: Engine, story) => {
		const calls = new Map<Person, Fiber.Fiber<typeof CallerAnswer.Type, unknown>>();
		let pending: Fiber.Fiber<unknown, unknown> | undefined;
		return {
			abortResourceCall: () => {
				story.tell("alice aborts the in-flight call");
				return pending === undefined ? Effect.die("Resource call has not started") : Fiber.interrupt(pending);
			},
			callerAnswer: (name: Person) => {
				const fiber = calls.get(name);
				return fiber === undefined ? Effect.die("Caller has not started") : Fiber.join(fiber);
			},
			callOn: (server: "first" | "second", name: string) => {
				story.tell(`alice calls ${name} on the ${server} server`);
				return call(server === "first" ? engine.clients.alice : engine.clients.second, name);
			},
			readResource: () => {
				story.tell("alice calls readResource again without waiting");
				return engine.clients.alice.callTool({ arguments: { wait: false }, schema: Schema.String, tool: tool("readResource") });
			},
			resourceReleased: () => Deferred.await(engine.released),
			resourceState: () => Effect.map(Deferred.await(engine.acquired), (handle) => (handle.fd === -1 ? "closed" : "open")),
			resumeCallers: () => {
				story.tell("both waiting handlers resume");
				return Deferred.succeed(engine.resume, undefined);
			},
			startCaller: (name: Person) =>
				Effect.gen(function* () {
					story.tell(`${name} calls caller and waits inside its handler`);
					const fiber = yield* engine.clients[name].callTool({ schema: CallerAnswer, tool: tool("caller") }).pipe(Effect.forkScoped);
					calls.set(name, fiber);
					yield* Queue.take(engine.entered);
				}),
			startResourceCall: () =>
				Effect.gen(function* () {
					story.tell("alice calls readResource and waits with an open file");
					pending = yield* engine.clients.alice
						.callTool({ arguments: { wait: true }, schema: Schema.String, tool: tool("readResource") })
						.pipe(Effect.forkScoped);
					yield* Deferred.await(engine.acquired);
				}),
			toolsOn: (server: "first" | "second") =>
				Effect.map((server === "first" ? engine.clients.alice : engine.clients.second).listTools(), (tools) => tools.map(({ name }) => name)),
		};
	},
});
