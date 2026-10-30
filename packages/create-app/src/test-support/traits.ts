import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { application, type Flag } from "./application.ts";
import { appScript } from "./environment.ts";
import { createAppIn, generateApp } from "./generate.ts";
import { templateSource } from "./templateSource.ts";

export const configuredIdentity = application.trait("workspace", "the user's global Git config names App Author <author@example.com>", (engine) => {
	const config = join(engine.root, "global.gitconfig");
	writeFileSync(config, "[user]\n\tname = App Author\n\temail = author@example.com\n");
	engine.environment.push(`GIT_CONFIG_GLOBAL=${config}`);
});

export const guessableEmail = application.trait(
	"workspace",
	"Git has no configured identity, but EMAIL=guessed@example.com would let it guess one",
	(engine) => {
		engine.environment.push("EMAIL=guessed@example.com");
	},
);

export const restrictiveUmask = application.trait("workspace", "the user's umask is 077, so new files are private by default", (engine) => {
	engine.environment.push("NODE_OPTIONS=--import=data:text/javascript,process.umask(0o077)");
});

export const permissiveUmask = application.trait("workspace", "the user's umask is 022, so new files are readable by others by default", (engine) => {
	engine.environment.push("NODE_OPTIONS=--import=data:text/javascript,process.umask(0o022)");
});

export const realSetup = application.trait("installation", "pnpm run setup installs the workspace Quality engine and its hook", (engine) => {
	engine.options = { ...engine.options, realSetup: true };
});

export const linkedPackageScripts = application.trait("installation", "package scripts run with linked workspace dependencies", (engine) => {
	engine.options = { ...engine.options, linkedPackageScripts: true };
});

export const installedPackageManager = application.trait(
	"workspace",
	"pnpm refuses to run when the app pins a version other than the installed one",
	(engine) => {
		engine.environment.push("PNPM_CONFIG_PM_ON_FAIL=error");
	},
);

export const failingQualityGate = application.trait("installation", "the installed Quality gate fails its typecheck with exit 7", (engine) => {
	engine.options = { ...engine.options, realSetup: true, typecheckExit: 7 };
});

export const missingGit = application.trait("installation", "Git is not on the PATH", (engine) => {
	engine.options = { ...engine.options, gitAvailable: false };
});

export const enclosingRepository = application.trait("workspace", "the workspace is a Git repository without commits", (engine) => {
	const result = spawnSync("git", ["init", "--quiet"], { cwd: engine.root, encoding: "utf8" });
	if (result.status !== 0) {
		throw new Error(result.stderr);
	}
});

export const installationFails = application.trait("installation", "pnpm run setup exits with 7", (engine) => {
	engine.options = { ...engine.options, installationExit: 7 };
});

export function destination(kind: "empty" | "file" | "nonempty" | "environment") {
	const described = {
		empty: "my-app is an empty folder",
		environment: "my-app is a folder holding only the user's .env.local",
		file: "my-app is a file",
		nonempty: "my-app is a folder holding the user's .keep",
	}[kind];
	return application.trait("installation", described, (engine) => {
		engine.options = { ...engine.options, destination: kind };
	});
}

export function customTemplate(files: Readonly<Record<string, string | Uint8Array>>, described = "the template holds its own files") {
	return application.trait("template", described, (engine) => {
		engine.source = templateSource(dirname(dirname(engine.cli)));
		engine.source.files(files);
	});
}

export const localArtifacts = application.trait(
	"template",
	"the template folder holds app.ts and .env.example beside node_modules, dist, coverage, .browser-check, .git, .env.local, .env, .env.production and pnpm-lock.yaml from local work",
	(engine) => {
		engine.source = templateSource(dirname(dirname(engine.cli)), { localArtifacts: true });
		engine.source.files({ "app.ts": "export const app = true;\n" });
	},
);

export function generated(folder: string, ...flags: readonly Flag[]) {
	return application.trait("generated", `create-app ${[folder, ...flags].join(" ")} created the app`, (engine) =>
		generateApp(engine, [folder, ...flags]),
	);
}

export const fullAppToCompare = application.trait("generated", "create-app full/my-app --no-git created a full app to compare with", (engine) =>
	generateApp(engine, ["full/my-app", "--no-git"]),
);

export function generatedWithOwnDatabases(...flags: readonly Flag[]) {
	const name = `app_${crypto.randomUUID().replaceAll("-", "")}`;
	return application.trait(
		"generated",
		`create-app ${[name, ...flags].join(" ")} created the app, named uniquely so no other story shares its databases`,
		(engine) => generateApp(engine, [name, ...flags]),
	);
}

export const creationFailedOnce = application.trait(
	"generated",
	"create-app my-app --no-git already stopped once at the failed installation",
	function* (engine) {
		const answer = yield* createAppIn(engine, ["my-app", "--no-git"]);
		if (answer === "created") {
			return yield* Effect.die(new Error("create-app created my-app although its installation was meant to fail"));
		}
	},
);

const DROP_DATABASES = `import { Pool } from "pg";
for (const value of [process.env.DATABASE_URL, process.env.TEST_DATABASE_URL]) {
  const url = new URL(value);
  const database = url.pathname.slice(1);
  url.pathname = "/postgres";
  const pool = new Pool({ connectionString: url.toString() });
  await pool.query('DROP DATABASE IF EXISTS "' + database + '" WITH (FORCE)');
  await pool.end();
}`;

export const databasesPrepared = application.trait(
	"app",
	"the app ran pnpm db:setup to create its development and test databases, which the story drops when it ends",
	function* (engine) {
		const folder = join(engine.root, engine.app);
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => spawnSync("node", ["--env-file=.env.local", "--input-type=module", "-e", DROP_DATABASES], { cwd: folder })),
		);
		const result = appScript(folder, "db:setup");
		if (result.status !== 0) {
			return yield* Effect.die(new Error(`pnpm db:setup failed:\n${result.stdout}${result.stderr}`));
		}
	},
);

export function appAdds(path: string, content: string) {
	return application.trait("app", `the app adds ${path} holding ${JSON.stringify(content)}`, (engine) =>
		Effect.sync(() => {
			const file = join(engine.root, engine.app, path);
			mkdirSync(dirname(file), { recursive: true });
			writeFileSync(file, content);
		}),
	);
}
