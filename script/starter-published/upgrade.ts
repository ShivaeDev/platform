import { Effect, FileSystem, Path, Schema } from "effect";
import { command, requireThat } from "#package-check/io.ts";
import { packedInstaller } from "#starter-published/packedInstaller.ts";
import { phase } from "#starter-published/phase.ts";
import { restoreStarter } from "#starter-published/restore.ts";

const decodeReport = Schema.decodeUnknownSync(
	Schema.fromJsonString(Schema.Struct({ numPassedTests: Schema.Number, numPendingTests: Schema.Number, numTotalTests: Schema.Number })),
);

export const checkUpgraded = Effect.fn("Published.checkUpgraded")(function* (app: string, directory: string, database: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	yield* Effect.log(yield* phase("upgraded build", command(app, "pnpm", ["run", "build"])));
	yield* Effect.log(
		yield* command(app, "env", [
			`TEST_DATABASE_URL=${database}`,
			"pnpm",
			"run",
			"test",
			"src/server/authMigrations.spec.ts",
			"src/server/browserReports.spec.ts",
			"--reporter=default",
			"--reporter=json",
			`--outputFile=${path.join(directory, "upgrade-stories.json")}`,
		]),
	);
	const report = decodeReport(yield* fs.readFileString(path.join(directory, "upgrade-stories.json")));
	yield* requireThat(
		report.numTotalTests > 0 && report.numPendingTests === 0 && report.numPassedTests === report.numTotalTests,
		"The upgraded app's PostgreSQL and HTTP stories must pass without skips.",
	);
});

export const upgradeStarter = Effect.fn("Published.upgradeStarter")(function* (
	root: string,
	temporary: string,
	app: string,
	current: string,
	tarballs: Readonly<Record<string, string>>,
	database: string,
	minimal: boolean,
) {
	const fs = yield* FileSystem.FileSystem;
	const paths = yield* Path.Path;
	const directory = paths.join(temporary, minimal ? "upgrade-minimal" : "upgrade-full");
	const generation = yield* fs.readFileString(paths.join(app, ".create-app.json"));
	yield* phase(`${minimal ? "minimal" : "full"} upgrade prepare`, restoreStarter(app, directory, minimal));
	const home = paths.join(app, "src/client/Home.tsx");
	const path = yield* packedInstaller(root, directory, tarballs);
	yield* Effect.log("Upgrading the reused historical app with a committed customization.");
	yield* Effect.log(yield* phase("upgrade install and typecheck", command(app, "env", [`PATH=${path}`, current, "update"])));
	yield* requireThat(
		(yield* fs.readFileString(paths.join(app, ".create-app.json"))) === generation,
		"The upgrade did not restore the current generation record.",
	);
	yield* requireThat((yield* fs.readFileString(home)).includes("Our customized app"), "The upgrade lost the committed home-page customization.");
	yield* checkUpgraded(app, directory, database);
});
