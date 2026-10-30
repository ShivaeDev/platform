import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, FileSystem, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { GitHub, read } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { PullRequest } from "./fixtures.ts";

export const readWithCliToken = Effect.fnUntraced(function* (
	apiUrl: string,
	token: string | undefined,
	variables: Record<string, string> = {},
	installed = true,
) {
	const fs = yield* FileSystem.FileSystem;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const directory = yield* fs.makeTempDirectoryScoped();
	if (installed) {
		yield* fs.writeFileString(
			`${directory}/gh`,
			`#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(token ?? "")}); process.exitCode = ${token === undefined ? 1 : 0};\n`,
		);
		yield* fs.chmod(`${directory}/gh`, 0o700);
	}
	const tokenLayer = GitHubToken.fromEnvOrCli.pipe(
		Layer.provide(
			Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(
				ChildProcessSpawner.make((command) => spawner.spawn(ChildProcess.setEnv(command, { "PATH": directory }))),
			),
		),
		Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(variables))),
	);
	const client = GitHub.layer.pipe(Layer.provide(Layer.mergeAll(FetchHttpClient.layer, tokenLayer, Layer.succeed(GitHubConfig)({ apiUrl }))));
	return yield* read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(client));
}, Effect.provide(NodeServices.layer));
