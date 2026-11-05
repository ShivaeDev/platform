import * as NodeServices from "@effect/platform-node/NodeServices";
import { DateTime, Effect, FileSystem, Layer, Path } from "effect";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { deployChild } from "./deployChild.ts";
import { mintUser } from "./sessionPrecondition.ts";

const assetLayer = Layer.merge(postgres, NodeServices.layer);

export const assets = storyKit({
	clock: Effect.runSync(DateTime.now),
	around: withIsolatedDatabase,
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "app-assets-" });
		yield* fs.makeDirectory(path.join(root, "dist", "assets"), { recursive: true });
		yield* fs.writeFileString(path.join(root, "dist", "index.html"), "<!doctype html><main>App shell</main>");
		yield* fs.writeFileString(path.join(root, "dist", "assets", "app.12345678.js"), 'console.log("App shell");');
		yield* fs.writeFileString(path.join(root, "dist", "robots.txt"), "User-agent: *");
		const database = yield* PostgresTestDatabase;
		const host = yield* deployChild("web", database.url, 0, {}, root);
		const url = yield* host.ready;
		return { cookies: new Map<string, string>(), url };
	},
	inspect: ({ url }) => ({ url }),
	layer: assetLayer,
	name: "assets",
	runIf: configured,
	stages: ["accounts"],
	verbs: (engine, story) => ({
		request: (pathname: string, name = "visitor") => {
			story.tell(`${name} requests ${pathname}`);
			return Effect.promise(async () => {
				const response = await fetch(new URL(pathname, engine.url), { headers: { accept: "text/html", cookie: engine.cookies.get(name) ?? "" } });
				return {
					body: await response.text(),
					cache: response.headers.get("cache-control"),
					frameAncestors: response.headers.get("content-security-policy"),
					frames: response.headers.get("x-frame-options"),
					status: response.status,
				};
			});
		},
	}),
});

export function assetAccount(name: string, role: string) {
	return assets.trait("accounts", `${name} is signed in as ${role}`, function* (engine) {
		const { headers } = yield* mintUser({ origin: engine.url }, name, role);
		engine.cookies.set(name, headers.get("cookie") ?? "");
	});
}
