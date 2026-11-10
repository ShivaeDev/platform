# @shivaedev/script

Short development scripts with native Effect arguments, configuration and resource lifetimes. Declare the work once; the Node entry point handles parsing, scope closure and process exit.

## Keep the script about its work

A small script should not need its own runtime and lifecycle wiring.

```ts
import { Config, Effect } from "effect";
import { Argument } from "effect/cli";
import { defineScript } from "@shivaedev/script/adapters/defineScript.ts";

defineScript({
	args: { name: Argument.String("name") },
	run: ({ name }) =>
		Effect.gen(function* () {
			const greeting = yield* Config.String("GREETING");
			yield* Effect.logInfo(`${greeting} ${name}`);
		}),
});
```

## Write and run a script

`defineScript` starts the script when the module is evaluated. `args` is a native Effect CLI configuration: use `Argument` for positional values and `Flag` for named options. The `run` callback receives their inferred values. Invalid arguments print a diagnostic and exit with code 1 before `run` starts. `--help` describes the arguments and exits with code 0 without running the work or reading its Config.

Use native `Config` inside the effect to read environment variables and native `Effect.logInfo` to log. A missing required configuration value fails the script. The entry point supplies Node platform services and a scope, so `Effect.acquireRelease` resources close on success, failure and Ctrl-C. Application services can be provided with native `Effect.provide` inside `run`.

```ts
import { Config, Effect, FileSystem } from "effect";
import { Argument, Flag } from "effect/cli";
import { defineScript } from "@shivaedev/script/adapters/defineScript.ts";

defineScript({
	args: {
		name: Argument.String("name"),
		count: Flag.Int("count").pipe(Flag.withDefault(1)),
	},
	run: ({ name, count }) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped();
			const greeting = yield* Config.String("GREETING");
			yield* fs.writeFileString(`${directory}/greeting.txt`, `${greeting} ${name}: ${count * 2}`);
			yield* Effect.logInfo(`Wrote a greeting for ${name}`);
		}),
});
```

`defineScript({ args, run })` returns `void` and owns the process entry point. `run` returns an Effect whose remaining requirements are Node services or `Scope`; provide application services in that effect. Success exits with code 0. An ordinary typed failure is reported and exits with code 1 after releasing resources. Ctrl-C interrupts the work, releases resources and exits with code 130. The native Node runtime owns reporting and exit conventions.

Install the script package with its native peers:

```sh
pnpm add @shivaedev/script effect @effect/platform-node
```

Save the first example as `greet.ts` and run it with Node:

```sh
GREETING=Hello node greet.ts Ada
```
