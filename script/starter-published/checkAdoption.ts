import { Clock, Effect, FileSystem, Path, Schema } from "effect";
import { command, requireThat } from "#package-check/io.ts";

const decodeReport = Schema.decodeUnknownSync(
	Schema.fromJsonString(Schema.Struct({ numPassedTests: Schema.Number, numPendingTests: Schema.Number, numTotalTests: Schema.Number })),
);

export const checkAdoption = Effect.fn("Published.checkAdoption")(function* (root: string, app: string, database: string) {
	const started = yield* Clock.currentTimeMillis;
	const path = yield* Path.Path;
	const fs = yield* FileSystem.FileSystem;
	const fixtures = path.join(root, "script/starter-published/adoption");
	const features = (yield* fs.readDirectory(fixtures)).toSorted();
	const modulesPath = path.join(app, "src/server/modules.ts");
	const hostPath = path.join(app, "src/server/applicationHost.ts");
	let modules = yield* fs.readFileString(modulesPath);
	let host = yield* fs.readFileString(hostPath);
	for (const [index, feature] of features.entries()) {
		const source = path.join(fixtures, feature);
		const name = `adoption${index}`;
		const target = path.join(app, "src/adoption", feature);
		for (const file of yield* fs.readDirectory(source, { recursive: true })) {
			if (!file.endsWith(".txt")) {
				continue;
			}
			const destination = path.join(target, file.slice(0, -4));
			yield* fs.makeDirectory(path.join(destination, ".."), { recursive: true });
			yield* fs.copyFile(path.join(source, file), destination);
		}
		const registration = `import { sample as ${name} } from "#adoption/${feature}/sample.ts";\n`;
		modules = registration + modules.replace("serverRegistration(),", `${name}.registration, serverRegistration(),`);
		host =
			registration
			+ host.replace(
				"routes: Layer.mergeAll(",
				`routes: Layer.mergeAll(${name}.routes(yield* SqlClient.SqlClient).pipe(Layer.provide(Layer.succeedContext(serviceContext))), `,
			);
	}
	yield* fs.writeFileString(modulesPath, modules);
	yield* fs.writeFileString(hostPath, `import { SqlClient } from "effect/sql";\n${host}`);
	yield* command(app, "pnpm", ["exec", "quality", "fix"]);
	yield* Effect.log(yield* command(app, "pnpm", ["run", "lint"]));
	yield* Effect.log(yield* command(app, "pnpm", ["run", "typecheck"]));
	const reportPath = path.join(app, "test-results/adoption.json");
	yield* Effect.log(
		yield* command(app, "env", [
			`TEST_DATABASE_URL=${database}`,
			"pnpm",
			"run",
			"test",
			"src/adoption",
			"--reporter=default",
			"--reporter=json",
			`--outputFile=${reportPath}`,
		]),
	);
	const report = decodeReport(yield* fs.readFileString(reportPath));
	yield* requireThat(
		report.numTotalTests > 0 && report.numPendingTests === 0 && report.numPassedTests === report.numTotalTests,
		"Adoption stories must pass against PostgreSQL without skips.",
	);
	yield* Effect.log(
		`Packed starter adoption (${features.join(", ")}): ${((yield* Clock.currentTimeMillis) - started) / 1000}s added, including fixture wiring, lint, typecheck and stories; no additional install.`,
	);
});
