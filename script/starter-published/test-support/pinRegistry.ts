import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { command, writeJson } from "#package-check/io.ts";

export const pinRegistry = Effect.fn("StarterStory.pinRegistry")(function* (root: string, peer: string) {
	const fs = yield* FileSystem.FileSystem;
	const manifests = [
		{ name: "@fixture/local-postgres", peerDependencies: { effect: peer }, types: "index.d.ts", version: "1.0.0" },
		{ description: "published on npm", name: "@fixture/unrelated", version: "1.0.0" },
		{ name: "effect", version: "4.1.1" },
	];
	const archives: Record<string, Uint8Array> = {};
	for (const [index, manifest] of manifests.entries()) {
		const source = join(root, `published-${index}`);
		yield* fs.makeDirectory(source);
		yield* writeJson(join(source, "package.json"), manifest);
		yield* fs.writeFileString(
			join(source, "index.d.ts"),
			"export declare function assertLocalDatabase(value: string, names: readonly string[]): void;\n",
		);
		const archive = join(root, `published-${index}.tgz`);
		yield* command(source, "pnpm", ["pack", "--out", archive]);
		archives[manifest.name] = yield* fs.readFile(archive);
	}
	let origin = "";
	const registry = yield* fakeHttpService({
		routes: {
			archive: { path: "/archives/:name", reply: ({ params }) => ({ chunks: [archives[params.name ?? ""] ?? new Uint8Array()] }) },
			metadata: {
				path: "/:name",
				reply: ({ params }) => ({
					body: registryDocument(
						origin,
						manifests.find(({ name }) => name === params.name),
					),
				}),
			},
		},
	});
	origin = registry.url;
	return origin;
});

function registryDocument(origin: string, manifest: { readonly name: string; readonly version: string } | undefined) {
	if (manifest === undefined) {
		return { versions: {} };
	}
	return {
		"dist-tags": { latest: manifest.version },
		name: manifest.name,
		time: { [manifest.version]: "2020-01-01T00:00:00.000Z" },
		versions: { [manifest.version]: { ...manifest, dist: { tarball: `${origin}/archives/${encodeURIComponent(manifest.name)}` } } },
	};
}
