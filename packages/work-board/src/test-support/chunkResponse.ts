import { Effect } from "effect";
import { act } from "react";
import { vi } from "vitest";
import { chunkImports } from "#client/react/adapters/chunkImports.ts";
import { createLazyChunks } from "#client/react/adapters/createLazyChunks.ts";
import { screenStory } from "./screenStory.ts";

type Chunk = "markdown" | "goalChart";

function response<T>(original: () => Promise<T>, failed: boolean) {
	const gate = Promise.withResolvers<boolean>();
	const control = {
		fail: () => gate.resolve(false),
		held: !failed,
		pending: true,
		release: () => gate.resolve(true),
		started: false,
	};
	if (failed) {
		control.fail();
	}
	return {
		control,
		load: async () => {
			control.started = true;
			try {
				if (!(await gate.promise)) {
					throw new TypeError("Failed to fetch dynamically imported module");
				}
				return await original();
			} finally {
				control.pending = false;
			}
		},
	};
}

function markdownResponse(failed: boolean) {
	const boundary = response(chunkImports.markdown, failed);
	vi.spyOn(chunkImports, "markdown").mockImplementation(boundary.load);
	return boundary;
}

function chartResponse(failed: boolean) {
	const boundary = response(chunkImports.goalChart, failed);
	vi.spyOn(chunkImports, "goalChart").mockImplementation(boundary.load);
	return boundary;
}

export function chunkResponse(chunk: Chunk, state: "held" | "failed") {
	return screenStory.trait("workspace", `the browser's ${chunk} chunk response is ${state}`, function* (engine) {
		const boundary = chunk === "markdown" ? markdownResponse(state === "failed") : chartResponse(state === "failed");
		engine.chunks = createLazyChunks();
		const { control } = boundary;
		engine.chunkResponse = {
			fail: () => {
				control.held = false;
				control.fail();
			},
			get held() {
				return control.held;
			},
			get pending() {
				return control.pending;
			},
			release: async () => {
				control.held = false;
				control.release();
				await engine.chunks[chunk].load();
			},
			get started() {
				return control.started;
			},
		};
		const release = engine.chunkResponse.release;
		engine.cleanups.push(() => act(release));
		yield* Effect.promise(() =>
			Promise.all(
				Object.entries(engine.chunks)
					.filter(([name]) => name !== chunk)
					.map(([, entry]) => entry.load()),
			),
		);
	});
}
