import { Effect, PlatformError } from "effect";
import { boardStory } from "./boardStory.ts";
import { directoryDenials as denied } from "./inventoryVerbs.ts";
import { wrapFilesystem } from "./storyEngine.ts";

function directoryAccess(relative: string, unreadable: boolean) {
	return boardStory.trait("project", `the filesystem ${unreadable ? "refuses" : "allows"} listing ${relative}`, (engine) => {
		const paths = denied.get(engine) ?? new Set<string>();
		denied.set(engine, paths);
		if (unreadable) {
			paths.add(`${engine.notes.root}/${relative}`);
		}
		wrapFilesystem(engine, (fs) => ({
			...fs,
			readDirectory: (path, options) =>
				Effect.suspend(() =>
					paths.has(path)
						? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readDirectory", module: "FileSystem" }))
						: fs.readDirectory(path, options),
				),
		}));
	});
}

export function unreadableDirectory(relative: string) {
	return directoryAccess(relative, true);
}

export function directoryReadsCanFail(relative: string) {
	return directoryAccess(relative, false);
}
