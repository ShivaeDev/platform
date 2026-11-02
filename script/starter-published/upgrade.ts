import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { command, requireThat } from "#package-check/io.ts";
import { generateStarter } from "#starter-published/generate.ts";
import { packedInstaller } from "#starter-published/packedInstaller.ts";

const PREVIOUS_VERSION = "0.35.0";
const decodeReport = Schema.decodeUnknownSync(
	Schema.fromJsonString(Schema.Struct({ numPassedTests: Schema.Number, numPendingTests: Schema.Number, numTotalTests: Schema.Number })),
);

export const upgradeStarter = Effect.fn("Published.upgradeStarter")(function* (
	root: string,
	temporary: string,
	current: string,
	tarballs: Readonly<Record<string, string>>,
	database: string,
	minimal: boolean,
) {
	const fs = yield* FileSystem.FileSystem;
	const directory = join(temporary, minimal ? "upgrade-minimal" : "upgrade-full");
	yield* fs.makeDirectory(directory);
	const archive = (yield* command(directory, "npm", [
		"pack",
		`@shivaedev/create-app@${PREVIOUS_VERSION}`,
		"--ignore-scripts",
		"--loglevel=error",
	])).trim();
	const folder = yield* generateStarter(root, directory, join(directory, archive), {}, undefined, minimal);
	const app = join(directory, folder);
	const home = join(app, "src/client/Home.tsx");
	const original = yield* fs.readFileString(home);
	yield* requireThat(original.includes("Your app"), "The previous starter must have a home-page heading to customize.");
	yield* fs.writeFileString(home, original.replace("Your app", "Our customized app"));
	yield* command(app, "git", ["add", "src/client/Home.tsx"]);
	yield* command(app, "git", [
		"-c",
		"user.name=Starter Consumer",
		"-c",
		"user.email=starter@example.test",
		"commit",
		"-m",
		"Customize the home page",
	]);
	const path = yield* packedInstaller(root, directory, tarballs);
	yield* Effect.log(`Upgrading ${folder} from packed create-app ${PREVIOUS_VERSION} with a committed customization.`);
	yield* Effect.log(yield* command(app, "env", [`PATH=${path}`, current, "update"]));
	yield* requireThat((yield* fs.readFileString(home)).includes("Our customized app"), "The upgrade lost the committed home-page customization.");
	yield* Effect.log(
		yield* command(app, "env", [
			`TEST_DATABASE_URL=${database}`,
			"pnpm",
			"run",
			"test",
			"src/server/authMigrations.spec.ts",
			"src/server/deployReadiness.spec.ts",
			"--reporter=default",
			"--reporter=json",
			`--outputFile=${join(directory, "upgrade-stories.json")}`,
		]),
	);
	const report = decodeReport(yield* fs.readFileString(join(directory, "upgrade-stories.json")));
	yield* requireThat(
		report.numTotalTests > 0 && report.numPendingTests === 0 && report.numPassedTests === report.numTotalTests,
		"The upgraded app's PostgreSQL and HTTP stories must pass without skips.",
	);
});
