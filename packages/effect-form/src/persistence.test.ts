import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { draftSession } from "#draftSession.ts";
import { make } from "#form.ts";
import { draftStorage } from "#test/draftStorage.ts";

const runtime = Atom.runtime(Layer.empty);
const Optional = Schema.Struct({ name: Schema.String, note: Schema.optionalKey(Schema.String) });

it("reload adopts fresh untouched arrays without mistaking JSON's new references for edits", () => {
	const { config } = draftStorage();
	const Lines = Schema.Struct({ lines: Schema.Array(Schema.Struct({ id: Schema.String })), name: Schema.String });
	const form = make(Lines, { initialValues: { lines: [{ id: "old" }], name: "First" }, onSubmit: Effect.succeed, persistedDraft: config, runtime });
	form.change("name", "Local");
	const reloaded = make(Lines, {
		initialValues: { lines: [{ id: "fresh" }], name: "Remote" },
		onSubmit: Effect.succeed,
		persistedDraft: config,
		runtime,
	});
	expect(reloaded.values.value).toEqual({ lines: [{ id: "fresh" }], name: "Local" });
});

it("reload preserves an edited array while adopting a fresh untouched string", () => {
	const { config } = draftStorage();
	const Lines = Schema.Struct({ lines: Schema.Array(Schema.Struct({ id: Schema.String })), name: Schema.String });
	const form = make(Lines, { initialValues: { lines: [{ id: "old" }], name: "First" }, onSubmit: Effect.succeed, persistedDraft: config, runtime });
	form.change("lines", [{ id: "local" }]);
	const reloaded = make(Lines, {
		initialValues: { lines: [{ id: "fresh" }], name: "Remote" },
		onSubmit: Effect.succeed,
		persistedDraft: config,
		runtime,
	});
	expect(reloaded.values.value).toEqual({ lines: [{ id: "local" }], name: "Remote" });
});

it("an explicit core session drops its draft and disables future writes from its form", () => {
	const { config, saved } = draftStorage();
	const session = draftSession("first");
	const form = make(Optional, { initialValues: { name: "First" }, onSubmit: Effect.succeed, persistedDraft: { ...config, session }, runtime });
	form.change("name", "Draft");
	expect(saved.size).toBe(1);
	session.drop();
	expect(saved.size).toBe(0);
	form.change("name", "Late edit");
	expect(saved.size).toBe(0);
});

it("restores a locally removed optional field without restoring the old key", () => {
	const { config, saved } = draftStorage();
	const initialValues = { name: "First", note: "Server" };
	const form = make(Optional, { initialValues, onSubmit: Effect.succeed, persistedDraft: config, runtime });
	form.values.set({ name: "Edited" });
	expect(saved.get("draft")).toContain("Edited");
	const reloaded = make(Optional, { initialValues, onSubmit: Effect.succeed, persistedDraft: config, runtime });
	expect(reloaded.values.value).toEqual({ name: "Edited" });
	reloaded.revert();
	expect(reloaded.values.value).toEqual(initialValues);
	expect(saved.size).toBe(0);
});

it("restores a locally added optional field against a baseline that omits it", () => {
	const { config } = draftStorage();
	const options = { initialValues: { name: "First" }, onSubmit: Effect.succeed, persistedDraft: config, runtime };
	const form = make(Optional, options);
	form.change("note", "Local");
	const reloaded = make(Optional, options);
	expect(reloaded.values.value).toEqual({ name: "First", note: "Local" });
});

it("a serialization failure removes the stale persisted snapshot and leaves the current input intact", () => {
	const { config, saved } = draftStorage();
	const Payload = Schema.Struct({ payload: Schema.Unknown });
	const form = make(Payload, { initialValues: { payload: "First" }, onSubmit: Effect.succeed, persistedDraft: config, runtime });
	form.change("payload", "Stored");
	expect(saved.get("draft")).toContain("Stored");
	const cyclic: { self?: object } = {};
	cyclic.self = cyclic;
	form.change("payload", cyclic);
	expect(form.values.value.payload).toBe(cyclic);
	expect(saved.size).toBe(0);
});
