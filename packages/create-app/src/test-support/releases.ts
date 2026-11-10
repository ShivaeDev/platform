import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { loopbackServer } from "@shivaedev/test-story/server/adapters/loopback.ts";

export const releases = Effect.fn("CreateAppStory.releases")(function* (root: string) {
	const archives = new Map<string, Uint8Array>();
	const server = createServer((request, response) => {
		if (request.url?.endsWith(".tgz")) {
			const version = request.url.slice(1, -4);
			const archive = archives.get(version);
			if (archive === undefined) {
				response.writeHead(HttpStatus.fromLiteral("NotFound")).end();
			} else {
				response.end(archive);
			}
		} else {
			response.setHeader("content-type", "application/json");
			const versions = Object.fromEntries(
				[...archives.keys()].map((version) => [
					version,
					{
						dist: { tarball: `${origin}/${version}.tgz` },
						name: "@shivaedev/create-app",
						version,
					},
				]),
			);
			response.end(JSON.stringify({ name: "@shivaedev/create-app", versions }));
		}
	});
	const origin = yield* loopbackServer(server);
	return {
		origin,
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
