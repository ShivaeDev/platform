import { execFileSync } from "node:child_process";

export function docker(args, options = {}) {
	const context = process.env.DOCKER_CONTEXT;
	const endpoint =
		(!context && process.env.DOCKER_HOST) ||
		execFileSync("docker", ["context", "inspect", ...(context ? [context] : []), "--format", "{{.Endpoints.docker.Host}}"], {
			encoding: "utf8",
		}).trim();
	const url = new URL(endpoint);
	if (
		!(["unix:", "npipe:"].includes(url.protocol) && ["", "localhost"].includes(url.hostname)) &&
		!(url.protocol === "tcp:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
	)
		throw new Error("Local database setup requires a local Docker endpoint; remote contexts are refused.");
	return execFileSync("docker", args, options);
}
