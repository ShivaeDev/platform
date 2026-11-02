import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { docker } from "#localDocker.ts";
import { environmentGate } from "#test/environmentGate.ts";
import { scriptedProcess } from "#test/scriptedProcess.ts";
import { attempt, recorded } from "#test/setupOutcome.ts";

export const dockerEndpoint = storyKit({
	clock: "live",
	*create() {
		const daemon = yield* fakeHttpService({
			routes: {
				containers: { method: "GET", path: "/v1.47/containers/json", reply: () => ({ body: [] }) },
				create: { method: "POST", path: "/v1.47/containers/create", reply: () => ({ body: { Id: "created-container", Warnings: [] }, status: 201 }) },
				exec: { method: "POST", path: "/v1.47/containers/development-postgres/exec", reply: () => ({ body: { Id: "query" }, status: 201 }) },
				execute: { method: "POST", path: "/v1.47/exec/query/start", reply: () => ({ status: 200 }) },
				info: { method: "GET", path: "/v1.47/info", reply: () => ({ body: { "ID": "approved-daemon" } }) },
				inspect: { method: "GET", path: "/v1.47/containers/development-postgres/json", reply: () => ({ body: { Id: "development-postgres" } }) },
				ping: { method: "HEAD", path: "/_ping", reply: () => ({ headers: { "API-Version": "1.47" } }) },
				restart: { method: "POST", path: "/v1.47/containers/development-postgres/restart", reply: () => ({ status: 204 }) },
				start: { method: "POST", path: "/v1.47/containers/:id/start", reply: () => ({ status: 204 }) },
				wait: { method: "POST", path: "/v1.47/containers/created-container/wait", reply: () => ({ body: { StatusCode: 0 } }) },
			},
		});
		const endpoint = daemon.url.replace("http:", "tcp:");
		const real = yield* ChildProcessSpawner.ChildProcessSpawner;
		const commands: (readonly string[])[] = [];
		const spawner = ChildProcessSpawner.make((command) => {
			if (command._tag !== "StandardCommand") {
				return Effect.die("The Docker endpoint kit expects a single command");
			}
			commands.push(command.args);
			// Context discovery is a precondition; operations use the real CLI and fake HTTP daemon.
			return command.args[0] === "context" ? Effect.succeed(scriptedProcess(endpoint)) : real.spawn(command);
		});
		const environment: Record<string, string> = {};
		const state: { outcome?: string; succeeded?: boolean } = {};
		return { ...state, commands, daemon, environment, spawner };
	},
	inspect: ({ commands, daemon, outcome }) => ({ commands, outcome, requests: daemon.requests }),
	layer: NodeServices.layer,
	name: "validated Docker endpoint",
	runIf: environmentGate("the Docker CLI", "docker", ["--version"]),
	stages: ["environment"],
	verbs: (engine, story) => ({
		commands: () => Effect.sync(() => engine.commands),
		outcome: () => recorded(engine.outcome),
		requests: () => Effect.sync(() => engine.daemon.requests.map(({ method, path }) => `${method} ${new URL(path, engine.daemon.url).pathname}`)),
		run: Effect.fn("DockerEndpoint.run")(function* (args: readonly string[]) {
			story.tell(`setup runs docker ${args.join(" ")}`);
			const result = yield* attempt(
				docker({ "DOCKER_CONTEXT": "approved" }, args, { env: { "DOCKER_API_VERSION": "1.47", ...engine.environment } }).pipe(
					Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, engine.spawner),
				),
			);
			engine.outcome = result.outcome;
			engine.succeeded = result.failure === undefined;
		}),
		succeeded: () => Effect.sync(() => engine.succeeded),
	}),
});

export function conflictingDockerEnvironment(key: "DOCKER_HOST" | "DOCKER_CONTEXT", value: string) {
	return dockerEndpoint.trait("environment", `the command environment sets conflicting ${key} to ${value}`, (engine) => {
		engine.environment[key] = value;
	});
}

export function matchingDockerEnvironment() {
	return dockerEndpoint.trait("environment", "the command environment also selects the approved context", (engine) => {
		engine.environment.DOCKER_CONTEXT = "approved";
	});
}
