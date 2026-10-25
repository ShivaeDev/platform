import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { Effect } from "effect";

export const releases = Effect.fn("CreateAppStory.releases")(function* (root: string) {
	const archives = new Map<string, Uint8Array>();
	const server = createServer((request, response) => {
		if (request.url?.endsWith(".tgz")) {
			const version = request.url.slice(1, -4);
			const archive = archives.get(version);
			if (archive === undefined) {
				response.writeHead(404).end();
			} else {
				response.end(archive);
			}
		} else {
			response.setHeader("content-type", "application/json");
			const versions = Object.fromEntries(
				[...archives.keys()].map((version) => [
					version,
					{
						dist: { tarball: `http://127.0.0.1:${port}/${version}.tgz` },
						name: "@shivaedev/create-app",
						version,
					},
				]),
			);
			response.end(JSON.stringify({ name: "@shivaedev/create-app", versions }));
		}
	});
	yield* Effect.acquireRelease(
		Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))),
		() => Effect.promise(() => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))),
	);
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("The release registry has no TCP address");
	}
	const port = address.port;
	return {
		origin: `http://127.0.0.1:${port}`,
		publish(version: string, template: string) {
			const directory = join(root, "release");
			mkdirSync(join(directory, "package"), { recursive: true });
			writeFileSync(join(directory, "package/package.json"), JSON.stringify({ name: "@shivaedev/create-app", version }));
			writeFileSync(join(directory, "package/template.json"), readFileSync(template));
			const archive = spawnSync("tar", ["-czf", "-", "package"], { cwd: directory });
			if (archive.status !== 0) {
				throw new Error(archive.stderr.toString());
			}
			archives.set(version, archive.stdout);
		},
	};
});
