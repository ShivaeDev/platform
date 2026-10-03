import { type ExecFileSyncOptionsWithStringEncoding, execFileSync } from "node:child_process";

export type DockerEnvironment = Readonly<{ DOCKER_CONTEXT?: string | undefined; DOCKER_HOST?: string | undefined }>;

export function docker(
	environment: DockerEnvironment,
	args: readonly string[],
	options: ExecFileSyncOptionsWithStringEncoding = { encoding: "utf8" },
) {
	const context = environment.DOCKER_CONTEXT;
	const host = environment.DOCKER_HOST;
	const endpoint =
		(!context && host)
		|| execFileSync("docker", ["context", "inspect", ...(context ? [context] : []), "--format", "{{.Endpoints.docker.Host}}"], {
			encoding: "utf8",
		}).trim();
	const url = new URL(endpoint);
	if (
		!(
			(["unix:", "npipe:"].includes(url.protocol) && ["", "localhost"].includes(url.hostname))
			|| (url.protocol === "tcp:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
		)
	) {
		throw new Error("Local database setup requires a local Docker endpoint; remote contexts are refused.");
	}
	return execFileSync("docker", args, options);
}
