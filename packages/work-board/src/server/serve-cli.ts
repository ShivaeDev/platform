#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer, Option, Path } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { DAEMON_PORT } from "#diagnostics/daemonContract.ts";
import { HOST, serveBoard } from "./serve.ts";

const VERSION = "0.11.0";

const serve = Effect.fn("WorkBoard.serve")(function* (input: {
	readonly dir: string;
	readonly fleetPort: number;
	readonly maintainer: string;
	readonly port: number;
	readonly responses: boolean;
	readonly home: Option.Option<string>;
}) {
	const path = yield* Path.Path;
	return yield* Layer.launch(
		serveBoard({
			fleetPort: input.fleetPort,
			home: Option.getOrUndefined(input.home),
			maintainer: input.maintainer,
			port: input.port,
			responses: input.responses,
			root: path.resolve(input.dir),
		}),
	);
});

const workBoard = Command.make(
	"work-board",
	{
		dir: Argument.directory("dir", { mustExist: true }).pipe(Argument.withDescription("The folder of markdown files to serve")),
		fleetPort: Flag.integer("fleet-port").pipe(Flag.withDefault(DAEMON_PORT), Flag.withDescription("Fleet daemon port for Diagnostics at 127.0.0.1")),
		home: Flag.string("home").pipe(Flag.optional, Flag.withDescription("The file shown as a board at /, relative to the folder")),
		maintainer: Flag.string("maintainer").pipe(
			Flag.withDefault("maintainer"),
			Flag.withDescription("The response_from label whose questions appear in the Inbox"),
		),
		port: Flag.integer("port").pipe(Flag.withDefault(4747), Flag.withDescription(`The port to listen on at ${HOST}`)),
		responses: Flag.boolean("responses").pipe(
			Flag.withDefault(false),
			Flag.withDescription("Explicitly enable local durable question, response and handoff writes (Linux)"),
		),
	},
	serve,
).pipe(Command.withDescription("Serve a folder of markdown files as a live page that updates in place when a file changes."));

export function runServe() {
	Command.run(workBoard, { version: VERSION }).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
