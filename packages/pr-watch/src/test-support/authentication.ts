import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import type { Engine } from "./engine.ts";
import { watch } from "./watch.ts";

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
	return watch.trait("settings", `no token variable is set and gh is signed in with ${token}`, (engine) => ghAccount(engine, token));
}

export const signedOut = watch.trait("settings", "no token variable is set and gh is signed out", (engine) => ghAccount(engine, undefined));

export function tokenVariables(variables: Record<string, string>) {
	return watch.trait(
		"settings",
		Object.entries(variables)
			.map(([name, value]) => `${name} is ${value}`)
			.join(" and "),
		(engine) => {
			engine.cliEnvironment = { ...engine.cliEnvironment, ...variables };
		},
	);
}
