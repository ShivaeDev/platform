import { constants } from "node:fs";
import { type FileHandle, mkdir, open, realpath } from "node:fs/promises";
import process from "node:process";
import { Effect } from "effect";
import { BadRequest, Conflict } from "@shivaedev/errors/taxonomy.ts";
import { PublicationUncertain } from "#rpc/rejections.ts";
import type { PublicationInput, ReplacementInput } from "#server/publication.ts";
import { directoryPath, publicationFailure, validateDirectory } from "./publicationDirectory.ts";
import { publicationEffect } from "./publicationEffect.ts";
import { publishIn } from "./publishIn.ts";

interface Directory {
	readonly expected: string;
	readonly file: FileHandle;
	readonly folder: string;
}

async function createDirectory(path: string) {
	try {
		await mkdir(path);
	} catch (cause) {
		if (!(cause instanceof Error && "code" in cause && cause.code === "EEXIST")) {
			throw cause;
		}
	}
}

async function publication(input: PublicationInput, signal: AbortSignal, expectedSource?: string) {
	const { root, realRoot, path, content } = input;
	const parts = path.split("/");
	const name = parts.pop();
	if (!name || [...parts, name].some((part) => part === "" || part === "." || part === "..")) {
		throw new Conflict({ message: "Invalid publication path." });
	}
	if (process.platform !== "linux" && process.platform !== "darwin") {
		throw new BadRequest({ message: "Local record publication requires Linux or macOS. Reading remains available." });
	}
	let published = false;
	const directories: Directory[] = [];
	async function validate() {
		for (const directory of directories) {
			await validateDirectory(directory.file, directory.folder, directory.expected);
		}
		if ((await realpath(root)) !== realRoot) {
			throw new Conflict({ message: "The workspace root changed. Restart against the intended root." });
		}
	}
	async function descend(directoryPathname: string, expected: string, index: number): Promise<void> {
		const file = await open(directoryPathname, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
		const directory = { expected, file, folder: directoryPath(file, expected) };
		directories.push(directory);
		try {
			await validate();
			signal.throwIfAborted();
			const part = parts[index];
			if (part === undefined) {
				await publishIn(file, root, realRoot, name ?? "", content, parts.join("/"), signal, expectedSource, validate);
				published = true;
				await validate();
			} else {
				if (expectedSource === undefined) {
					await createDirectory(`${directory.folder}/${part}`);
					await validate();
					await file.sync();
				}
				await descend(`${directory.folder}/${part}`, `${expected}/${part}`, index + 1);
			}
		} catch (cause) {
			published ||= cause instanceof PublicationUncertain;
			publicationFailure(cause, published);
		} finally {
			directories.pop();
			await file.close().catch((cause: unknown) => publicationFailure(cause, published));
		}
	}
	await descend(root, realRoot, 0);
}

export const makePublication = Effect.succeed({
	publishOnce: (input: PublicationInput) => publicationEffect((signal) => publication(input, signal)),
	replaceIfUnchanged: (input: ReplacementInput) => publicationEffect((signal) => publication(input, signal, input.expectedSource)),
});
