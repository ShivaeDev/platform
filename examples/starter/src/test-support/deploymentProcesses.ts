import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { authPost, credentials } from "./authHttp.ts";
import { deployChild } from "./deployChild.ts";

type DeployedProcess = Effect.Success<ReturnType<typeof deployChild>>;

export interface DeploymentEngine {
	address: string | undefined;
	readonly processes: Map<string, DeployedProcess>;
}

export function deploymentEngine(): DeploymentEngine {
	return { address: undefined, processes: new Map() };
}

export function releaseEnv(release: string): Record<string, string> {
	return { "RAILWAY_GIT_COMMIT_SHA": release };
}

function startupFailure(message: string) {
	return message.includes("Database migrations are not current") ? "refused: database migrations are not current" : `failed: ${message}`;
}

export function webAddress(engine: DeploymentEngine) {
	if (engine.address === undefined) {
		throw new Error("The web process has not started");
	}
	return engine.address;
}

export function deploymentControls(engine: DeploymentEngine) {
	return {
		processOf: (name: string) => {
			const found = engine.processes.get(name);
			if (found === undefined) {
				throw new Error(`No process is named ${name}`);
			}
			return found;
		},
		start: Effect.fn("DeploymentStory.start")(function* (name: string, kind: "worker" | "web" | "migrate", env: Record<string, string>, port = 0) {
			const database = yield* PostgresTestDatabase;
			const child = yield* deployChild(kind, database.url, port, env).pipe(Effect.provide(NodeServices.layer));
			engine.processes.set(name, child);
			return child;
		}),
	};
}

export function deploymentVerbs(engine: DeploymentEngine, tell: (line: string) => void) {
	const { processOf, start } = deploymentControls(engine);
	return {
		health: Effect.fn("DeploymentStory.health")(function* () {
			const response = yield* Effect.promise(() => fetch(`${webAddress(engine)}/health`));
			yield* Effect.promise(() => response.text());
			return response.status === HttpStatus.fromLiteral("OK") ? "healthy" : `unhealthy with HTTP ${response.status}`;
		}),
		loadedModules: (name: string, pattern: RegExp) =>
			Effect.sync(() =>
				processOf(name)
					.logs.filter((line) => line.startsWith("Loaded module: ") && pattern.test(line))
					.map((line) => line.replace(/^.*\//v, "")),
			),
		logLines: (name: string, pattern: RegExp) =>
			Effect.sync(() => {
				const { errors, logs } = processOf(name);
				return [...logs, ...errors].filter((line) => pattern.test(line));
			}),
		migrates: Effect.fn("DeploymentStory.migrates")(function* (release: string) {
			tell(`release ${release} migrates the database`);
			const migration = yield* start(`${release} migration`, "migrate", releaseEnv(release));
			const code = yield* migration.exitCode;
			if (code !== 0) {
				return yield* Effect.die(`The ${release} migration exited with code ${code}\n${[...migration.logs, ...migration.errors].join("\n")}`);
			}
		}),
		migrationFinishes: Effect.fn("DeploymentStory.migrationFinishes")(function* (release: string) {
			const code = yield* processOf(`${release} migration`).exitCode;
			return code === 0 ? "migrated" : `exited with code ${code}`;
		}),
		processState: Effect.fn("DeploymentStory.processState")(function* (name: string) {
			const process = processOf(name);
			return (yield* process.child.isRunning) ? "running" : `exited with code ${yield* process.exitCode}`;
		}),
		signsUpOverHttp: Effect.fn("DeploymentStory.signsUpOverHttp")(function* (name: string) {
			tell(`${name} signs up over HTTP`);
			const response = yield* authPost(webAddress(engine), "sign-up/email", credentials(name));
			return response.status === HttpStatus.fromLiteral("OK") && response.cookie.includes("session_token=")
				? "signed up with a session"
				: `refused with HTTP ${response.status}`;
		}),
		startsMigrating: Effect.fn("DeploymentStory.startsMigrating")(function* (release: string) {
			tell(`release ${release} starts migrating the database`);
			yield* start(`${release} migration`, "migrate", releaseEnv(release));
		}),
		webStartAnswer: Effect.fn("DeploymentStory.webStartAnswer")(function* (port = 0) {
			tell(port === 0 ? "the web process starts" : `the web process starts on port ${port}`);
			const web = yield* start("web", "web", {}, port);
			return yield* web.ready.pipe(
				Effect.match({
					onFailure: (error) => startupFailure(error.message),
					onSuccess: (address) => {
						engine.address = address;
						return "ready";
					},
				}),
			);
		}),
		webStarts: Effect.fn("DeploymentStory.webStarts")(function* (env: Record<string, string> = {}) {
			tell("the web process starts");
			const web = yield* start("web", "web", env);
			engine.address = yield* web.ready;
		}),
		workerBecomesReady: Effect.fn("DeploymentStory.workerBecomesReady")(function* (release: string) {
			yield* processOf(`${release} worker`).ready;
			return "ready";
		}),
		workerStarts: Effect.fn("DeploymentStory.workerStarts")(function* (release: string) {
			tell(`the ${release} worker starts`);
			const worker = yield* start(`${release} worker`, "worker", releaseEnv(release));
			yield* worker.ready;
		}),
		workerStartsWaiting: Effect.fn("DeploymentStory.workerStartsWaiting")(function* (release: string) {
			tell(`the ${release} worker starts before its release has migrated`);
			const worker = yield* start(`${release} worker`, "worker", releaseEnv(release));
			yield* worker.waitingForSchema;
		}),
	};
}
