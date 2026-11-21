import { Effect, FileSystem, Path } from "effect";
import { writeFiles } from "#test/fixtureProject.ts";
import { generator } from "#test/generator.ts";

const MANIFEST = `${JSON.stringify({ exports: { "./*.ts": "./src/*.ts" }, name: "@shivaedev/server", type: "module" }, undefined, "\t")}\n`;

// The form @shivaedev/server declared before a defined module could register, one interface for every registration.
const INTERFACE = `export interface AppModule {
	readonly admin?: ModuleAdmin;
	readonly group: RpcGroup.Any;
	readonly handlers: ModuleLayer;
	readonly migrations: Pick<MigrationOptions<unknown, unknown>, "loader" | "components">;
	readonly name: string;
	readonly queues?: readonly { readonly name: string }[];
	readonly services: ModuleLayer;
	readonly workers?: ModuleLayer;
}
`;

const NO_APP_MODULE = "export type ModuleLayer = Layer.Any;\n";

const NO_SHARED_PART =
	"export type AppModule = { readonly group: RpcGroup.Any; readonly handlers: ModuleLayer } | { readonly module: RegisteredModule };\n";

export type InstalledAppModule = "an interface" | "no AppModule" | "an AppModule whose forms share no property";

function installedServerFiles(declaration: InstalledAppModule): Readonly<Record<string, string>> {
	const text = { "an AppModule whose forms share no property": NO_SHARED_PART, "an interface": INTERFACE, "no AppModule": NO_APP_MODULE }[
		declaration
	];
	return { "node_modules/@shivaedev/server/package.json": MANIFEST, "node_modules/@shivaedev/server/src/AppModule.ts": text };
}

// The link to this repository's own @shivaedev/server is removed, never followed, so the package itself is left alone.
const unlinksServer = Effect.fn("BuildStory.unlinksServer")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	yield* fs.remove(path.join(root, "node_modules", "@shivaedev", "server"));
});

export function serverInstalledWith(declaration: InstalledAppModule) {
	return generator.trait("project", `the project's installed @shivaedev/server declares ${declaration}`, ({ root }) =>
		unlinksServer(root).pipe(Effect.andThen(writeFiles(root, installedServerFiles(declaration)))),
	);
}

export function noServerInstalled() {
	return generator.trait("project", "the project has no @shivaedev/server installed", ({ root }) => unlinksServer(root));
}
