import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { TestClock } from "effect/testing";
import type { draftStorage } from "./draftStorage.ts";
import { formStories } from "./formStories.ts";

function storedBytes({ config, saved }: ReturnType<typeof draftStorage>) {
	return new TextEncoder().encode(saved.get(config.key) ?? "").byteLength;
}

function rewriteStoredDraft(
	{ config, saved }: ReturnType<typeof draftStorage>,
	change: (record: Record<string, unknown>) => Record<string, unknown>,
) {
	const raw = saved.get(config.key);
	if (raw === undefined) {
		throw new Error(`No draft is stored under ${config.key}`);
	}
	saved.set(config.key, JSON.stringify(change(JSON.parse(raw))));
}

export const draftNames = formStories(() => Schema.Struct({ name: Schema.String }), {
	config: () => ({ initialValues: { name: "First" }, onSubmit: Effect.succeed, runtime: Atom.runtime(Layer.empty) }),
	support: () => undefined,
	verbs: (driver, tell) => ({
		enterNameStoredAs: (bytes: number) =>
			Effect.sync(() => {
				tell(`enter a name whose stored draft takes ${bytes} bytes`);
				const storage = driver.engine.storage;
				driver.current().change("name", "a");
				const name = "a".repeat(bytes - (storedBytes(storage) - 1));
				driver.current().change("name", name);
				return name;
			}),
		storedDraftBytes: () => Effect.sync(() => storedBytes(driver.engine.storage)),
	}),
});

export function storedDraftPaddedTo(bytes: number) {
	return draftNames.step(`the stored draft is padded to ${bytes} bytes`, (_driver, engine) =>
		rewriteStoredDraft(engine.storage, (record) => {
			const unpadded = JSON.stringify({ ...record, padding: "" }).length;
			return { ...record, padding: "x".repeat(bytes - unpadded) };
		}),
	);
}

export function draftAged(line: string, ms: number) {
	return draftNames.step(`the draft ages by ${line}`, () => TestClock.adjust(ms));
}
