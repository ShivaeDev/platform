import { createHash } from "node:crypto";
import { type FSWatcher, watch } from "node:fs";
import { dirname } from "node:path";
import { codeDigest } from "./codeDigest.ts";

export interface LoadedFile {
	readonly digest: string;
	readonly directory: string;
	readonly file: string;
}

export class LoadedCode {
	readonly #files = new Map<string, string>();
	readonly #watchers = new Map<string, FSWatcher | undefined>();
	#changedAt: number | undefined;
	#pending = false;
	#checkedAt: number;

	constructor(now: number) {
		this.#checkedAt = now;
	}

	add(record: LoadedFile) {
		this.#files.set(record.file, record.digest);
		for (const directory of new Set([record.directory, dirname(record.file)])) {
			if (!this.#watchers.has(directory)) {
				this.#watchers.set(directory, this.#watch(directory));
			}
		}
		this.#pending = true;
	}

	#watch(directory: string) {
		try {
			const watcher = watch(directory, () => {
				this.#pending = true;
			});
			watcher.on("error", () => watcher.close());
			return watcher;
		} catch {
			return undefined;
		}
	}

	check(now: number) {
		if (this.#pending) {
			this.#changedAt = now;
			this.#pending = false;
		}
		if (this.#changedAt === undefined ? now - this.#checkedAt < 60_000 : now - this.#changedAt < 2000) {
			return undefined;
		}
		this.#checkedAt = now;
		this.#changedAt = undefined;
		const hash = createHash("sha256");
		let changed = false;
		for (const [file, previous] of [...this.#files].sort(([a], [b]) => a.localeCompare(b))) {
			const digest = codeDigest(file);
			hash.update(file).update(digest);
			changed ||= digest !== previous;
		}
		return { changed, revision: `sha256:${hash.digest("hex")}` };
	}

	close() {
		for (const watcher of this.#watchers.values()) {
			watcher?.close();
		}
	}
}
