import { Effect } from "effect";
import { LocalPostgresError } from "#LocalPostgresError.ts";
import { type CommandOptions, runCommand } from "#runCommand.ts";

export type DockerEnvironment = Readonly<{ "DOCKER_CONTEXT"?: string | undefined; "DOCKER_HOST"?: string | undefined }>;

export const docker = Effect.fn("LocalPostgres.docker")(function* (
	environment: DockerEnvironment,
	args: readonly string[],
	options: CommandOptions = {},
) {
	const context = environment.DOCKER_CONTEXT;
	const host = environment.DOCKER_HOST;
	if ((["DOCKER_CONTEXT", "DOCKER_HOST"] as const).some((key) => options.env?.[key] && options.env[key] !== environment[key])) {
		return yield* new LocalPostgresError({ message: "Docker command environment conflicts with the Docker endpoint settings." });
	}
	const settings = {
		...options,
		env: { ...environment, ...options.env, "DOCKER_CONTEXT": context ?? "", "DOCKER_HOST": host ?? "" },
		extendEnv: true,
	};
	const endpoint =
		(!context && host)
		|| (yield* runCommand("docker", ["context", "inspect", ...(context ? [context] : []), "--format", "{{.Endpoints.docker.Host}}"], settings));
	const url = yield* Effect.try({ catch: () => new LocalPostgresError({ message: "Invalid Docker endpoint." }), try: () => new URL(endpoint) });
	if (
		!(
			(["unix:", "npipe:"].includes(url.protocol) && ["", "localhost"].includes(url.hostname))
			|| (url.protocol === "tcp:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
		)
	) {
		return yield* new LocalPostgresError({ message: "Local database setup requires a local Docker endpoint; remote contexts are refused." });
	}
	return yield* runCommand("docker", args, { ...settings, env: { ...settings.env, "DOCKER_CONTEXT": "", "DOCKER_HOST": endpoint } });
});
