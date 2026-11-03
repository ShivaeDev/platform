import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Console, Effect, FileSystem } from "effect";
import { Command, Flag } from "effect/cli";
import { playwright } from "@shivaedev/browser-check/adapters/playwright.ts";
import { liveNotes } from "./live.ts";

const command = Command.make(
	"live-notes",
	{
		url: Flag.String("url").pipe(Flag.withDefault("http://127.0.0.1:5173")),
	},
	({ url }) =>
		Effect.gen(function* () {
			const email = yield* Config.String("BROWSER_CHECK_EMAIL");
			const password = yield* Config.String("BROWSER_CHECK_PASSWORD");
			const fs = yield* FileSystem.FileSystem;
			const folder = ".browser-check";
			yield* fs.remove(folder, { force: true, recursive: true });
			yield* fs.makeDirectory(folder, { recursive: true });
			yield* liveNotes(url, folder, { email, password });
			yield* Console.log("browser-check: two-tab socket update and session sign-out passed.");
		}).pipe(Effect.scoped),
);

Command.run(command, { version: "0.0.0" }).pipe(
	Effect.provide(playwright),
	Effect.tapErrorTag("BrowserCheckError", (error) => Console.error(`browser-check: ${error.message}`)),
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);
