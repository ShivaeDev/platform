#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer, Option, Path } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { HOST, serveBoard } from "./serve.ts";

const VERSION = "0.1.0";

const serve = Effect.fn("WorkBoard.serve")(function* (input: { readonly dir: string; readonly port: number; readonly home: Option.Option<string> }) {
	const path = yield* Path.Path;
	return yield* Layer.launch(serveBoard({ root: path.resolve(input.dir), home: Option.getOrUndefined(input.home), port: input.port }));
});

const workBoard = Command.make(
	"work-board",
	{
		dir: Argument.directory("dir", { mustExist: true }).pipe(Argument.withDescription("The folder of markdown files to serve")),
		port: Flag.integer("port").pipe(Flag.withDefault(4747), Flag.withDescription(`The port to listen on at ${HOST}`)),
		home: Flag.string("home").pipe(Flag.optional, Flag.withDescription("The file shown as a board at /, relative to the folder")),
	},
	serve,
).pipe(Command.withDescription("Serve a folder of markdown files as a live page that updates in place when a file changes."));

Command.run(workBoard, { version: VERSION }).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
