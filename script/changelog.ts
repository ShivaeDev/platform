import process from "node:process";
import { Clock, Config, Console, Effect } from "effect";
import { checkRepository } from "#changelog/checkRepository.ts";
import { releasePackage } from "#changelog/releasePackage.ts";
import { runMain } from "#lint/adapters/run.ts";

const [command, argument] = process.argv.slice(2);
const program = Effect.gen(function* () {
	if (command === "check" || command === "--check") {
		yield* checkRepository(process.cwd(), argument ?? (yield* Config.string("CHANGELOG_BASE_REF").pipe(Config.withDefault("origin/main"))));
		yield* Console.log("Changelog fragments and release notes are valid.");
		return;
	}
	if (command === undefined || !/^[a-z][a-z0-9-]*$/u.test(command)) {
		return yield* Effect.fail(new Error("Use pnpm run changelog:release <package>, or pnpm run changelog:check [base-ref]."));
	}
	const count = yield* releasePackage(`${process.cwd()}/packages/${command}`, new Date(yield* Clock.currentTimeMillis).toISOString().slice(0, 10));
	yield* Console.log(`${command}: collected ${count} fragment(s).`);
});
runMain(program);
