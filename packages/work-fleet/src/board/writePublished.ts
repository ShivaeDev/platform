import { constants } from "node:fs";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { Effect } from "effect";
import { directoryPath, validateDirectory } from "@shivaedev/work-board/responses/publicationDirectory.ts";
import { BoardFailure } from "#policy.ts";

async function unchanged(folder: string, name: "status.md" | "health.json", content: string, owns: (source: string) => boolean): Promise<boolean> {
	const previous = await open(`${folder}/${name}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK).catch((cause: unknown) => {
		if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
			return undefined;
		}
		throw cause;
	});
	if (previous === undefined) {
		return false;
	}
	try {
		const stat = await previous.stat();
		if (!stat.isFile() || stat.size > 8 * 1024 * 1024) {
			throw new Error("Publication target must be a regular file under 8 MiB");
		}
		const source = await readFile(previous, "utf8");
		if (!owns(source)) {
			throw new Error(`fleet/${name} contains authored content`);
		}
		return source === content;
	} finally {
		await previous.close();
	}
}

export function writePublished(
	root: string,
	realRoot: string,
	name: "status.md" | "health.json",
	content: string,
	owns: (source: string) => boolean,
) {
	return Effect.tryPromise({
		catch: () => new BoardFailure({ message: `Fleet publication failed for fleet/${name}. Check local filesystem access and existing content.` }),
		try: async () => {
			const directory = await open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
			try {
				const base = directoryPath(directory, realRoot);
				await validateDirectory(directory, base, realRoot);
				await mkdir(`${base}/fleet`).catch((cause: unknown) => {
					if (!(cause instanceof Error && "code" in cause && cause.code === "EEXIST")) {
						throw cause;
					}
				});
				const target = await open(`${base}/fleet`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
				const folder = directoryPath(target, `${realRoot}/fleet`);
				const temporary = `${folder}/.${name}-${crypto.randomUUID()}.tmp`;
				try {
					await validateDirectory(target, folder, `${realRoot}/fleet`);
					if (await unchanged(folder, name, content, owns)) {
						return;
					}
					const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
					try {
						await file.writeFile(content, "utf8");
						await file.sync();
					} finally {
						await file.close();
					}
					await validateDirectory(directory, base, realRoot);
					await validateDirectory(target, folder, `${realRoot}/fleet`);
					await rename(temporary, `${folder}/${name}`);
					await target.sync();
				} finally {
					await rm(temporary, { force: true });
					await target.close();
				}
			} finally {
				await directory.close();
			}
		},
	});
}
