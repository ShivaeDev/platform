import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import type { Engine } from "#test/engine.ts";
import { watch } from "#test/watch.ts";

const ghAccount = Effect.fnUntraced(function* (engine: Engine, token: string | undefined) {
	const fs = engine.io.fs;
	const directory = yield* fs.makeTempDirectoryScoped();
	const command = join(directory, "gh");
	yield* fs.writeFileString(
		command,
		`#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(token ?? "")}); process.exitCode = ${token === undefined ? 1 : 0};\n`,
	);
	yield* fs.chmod(command, 0o700);
	engine.cliEnvironment = { "PATH": directory };
});

export function signedInGh(token: string) {
	return watch.trait("github", "gh is signed in without environment tokens", (engine) => ghAccount(engine, token));
}
export const signedOutGh = watch.trait("github", "no environment tokens or gh account are available", (engine) => ghAccount(engine, undefined));

export function environmentTokens(variables: Record<string, string>) {
	return watch.trait("github", "GitHub environment tokens are configured", (engine) => {
		engine.cliEnvironment = { ...engine.cliEnvironment, ...variables };
	});
}
