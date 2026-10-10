import { truncateSync, unlinkSync } from "node:fs";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer } from "effect";
import type { FileSystemWrapper } from "#test/board.ts";

export function unlinkBeforeStat(target: string) {
	let removed = false;
	return Layer.effect(
		FileSystem.FileSystem,
		Effect.map(Effect.service(FileSystem.FileSystem), (fs) => ({
			...fs,
			stat: (file) =>
				Effect.suspend(() => {
					if (!removed && file === target) {
						unlinkSync(target);
						removed = true;
					}
					return fs.stat(file);
				}),
		})),
	).pipe(Layer.provideMerge(NodeServices.layer));
}

export function growBeforeRead(target: string, bytes: number): FileSystemWrapper {
	return (fs) => ({
		...fs,
		readFile: (file) =>
			Effect.suspend(() => {
				if (file === target) {
					truncateSync(target, bytes);
				}
				return fs.readFile(file);
			}),
	});
}
