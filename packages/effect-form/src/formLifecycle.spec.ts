import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as Form from "#form.ts";

const Name = Schema.Struct({ name: Schema.Trim });
const runtime = Atom.runtime(Layer.empty);

it.live("a successful save establishes the submitted baseline", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = Form.make(Name, {
			initialValues: { name: "First" },
			onSubmit: Effect.succeed,
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		form.change("name", "  Saved  ");
		registry.set(form.submit, undefined);
		expect(yield* AtomRegistry.getResult(registry, form.submit)).toEqual({
			name: "Saved",
		});
		expect(form.values.value).toEqual({ name: "  Saved  " });
		expect(registry.get(form.dirty)).toBe(false);
		form.change("name", "First");
		expect(registry.get(form.dirty)).toBe(true);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a rejected save keeps the draft dirty", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = Form.make(Name, {
			initialValues: { name: "First" },
			onSubmit: (_, submitter) => submitter.fail("name", "Already used"),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		form.change("name", "Taken");
		registry.set(form.submit, undefined);
		expect(yield* Effect.flip(AtomRegistry.getResult(registry, form.submit))).toMatchObject({ message: "Already used" });
		expect(form.values.value).toEqual({ name: "Taken" });
		expect(registry.get(form.dirty)).toBe(true);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("edits made during a save remain dirty after it succeeds", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const started = yield* Deferred.make<void>();
		const complete = yield* Deferred.make<void>();
		const form = Form.make(Name, {
			initialValues: { name: "First" },
			onSubmit: (value) => Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(complete)), Effect.as(value)),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		form.change("name", "Submitted");
		registry.set(form.submit, undefined);
		yield* Deferred.await(started);
		form.change("name", "Still editing");
		yield* Deferred.succeed(complete, undefined);
		expect(
			yield* AtomRegistry.getResult(registry, form.submit, {
				suspendOnWaiting: true,
			}),
		).toEqual({ name: "Submitted" });
		expect(form.values.value).toEqual({ name: "Still editing" });
		expect(registry.get(form.dirty)).toBe(true);
		form.change("name", "Submitted");
		expect(registry.get(form.dirty)).toBe(false);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a late field rejection does not attach to a newer edit", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const started = yield* Deferred.make<void>();
		const complete = yield* Deferred.make<void>();
		const form = Form.make(Name, {
			initialValues: { name: "First" },
			onSubmit: (_, submitter) =>
				Deferred.succeed(started, undefined).pipe(
					Effect.andThen(Deferred.await(complete)),
					Effect.andThen(submitter.fail("name", "Submitted name is taken")),
				),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.error("name"));
		form.change("name", "Submitted");
		registry.set(form.submit, undefined);
		yield* Deferred.await(started);
		form.change("name", "Newer");
		yield* Deferred.succeed(complete, undefined);
		yield* Effect.flip(AtomRegistry.getResult(registry, form.submit, { suspendOnWaiting: true }));
		expect(registry.get(form.error("name"))).toBeUndefined();
		expect(form.values.value.name).toBe("Newer");
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

const Entry = Schema.Struct({ name: Schema.Trim, note: Schema.String });

function gated(started: Deferred.Deferred<void>, release: Deferred.Deferred<void>) {
	return <A>(value: A) => Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(value));
}

it.live("a refresh received during a save stays the baseline after it succeeds", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const started = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const form = Form.make(Name, {
			initialValues: { name: "First" },
			onSubmit: gated(started, release),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		form.change("name", "  Saved  ");
		registry.set(form.submit, undefined);
		yield* Deferred.await(started);
		form.receive({ name: "Saved" });
		yield* Deferred.succeed(release, undefined);
		yield* AtomRegistry.getResult(registry, form.submit, {
			suspendOnWaiting: true,
		});
		expect(form.values.value).toEqual({ name: "  Saved  " });
		expect(registry.get(form.dirty)).toBe(false);
		form.revert();
		expect(form.values.value).toEqual({ name: "Saved" });
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("edits made after submission stay dirty against a refresh received during the save", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const started = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const form = Form.make(Name, {
			initialValues: { name: "First" },
			onSubmit: gated(started, release),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		form.change("name", "Submitted");
		registry.set(form.submit, undefined);
		yield* Deferred.await(started);
		form.receive({ name: "Remote" });
		form.change("name", "Newer");
		yield* Deferred.succeed(release, undefined);
		yield* AtomRegistry.getResult(registry, form.submit, {
			suspendOnWaiting: true,
		});
		expect(form.values.value).toEqual({ name: "Newer" });
		expect(registry.get(form.dirty)).toBe(true);
		form.change("name", "Remote");
		expect(registry.get(form.dirty)).toBe(false);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a stale refresh during a save does not replace the submitted value", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const started = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const form = Form.make(Name, {
			initialValues: { name: "First" },
			onSubmit: gated(started, release),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		form.change("name", "Submitted");
		registry.set(form.submit, undefined);
		yield* Deferred.await(started);
		form.receive({ name: "First" });
		yield* Deferred.succeed(release, undefined);
		yield* AtomRegistry.getResult(registry, form.submit, {
			suspendOnWaiting: true,
		});
		expect(form.values.value).toEqual({ name: "Submitted" });
		expect(registry.get(form.dirty)).toBe(false);
		form.receive({ name: "Submitted by server" });
		expect(form.values.value).toEqual({ name: "Submitted by server" });
		expect(registry.get(form.dirty)).toBe(false);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a normalized server value lands in a clean field but not in a dirty one", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = Form.make(Entry, {
			initialValues: { name: "First", note: "" },
			onSubmit: Effect.succeed,
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		form.change("name", "  Saved  ");
		registry.set(form.submit, undefined);
		yield* AtomRegistry.getResult(registry, form.submit);
		form.change("note", "  local  ");
		form.receive({ name: "Saved", note: "server" });
		expect(form.values.value).toEqual({ name: "Saved", note: "  local  " });
		expect(registry.get(form.dirty)).toBe(true);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a failed save leaves a refresh received during it as the baseline", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const started = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const form = Form.make(Entry, {
			initialValues: { name: "First", note: "" },
			onSubmit: (_, submitter) =>
				Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.andThen(submitter.fail("name", "Taken"))),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		form.change("name", "Submitted");
		registry.set(form.submit, undefined);
		yield* Deferred.await(started);
		form.receive({ name: "First", note: "Remote" });
		yield* Deferred.succeed(release, undefined);
		yield* Effect.flip(
			AtomRegistry.getResult(registry, form.submit, {
				suspendOnWaiting: true,
			}),
		);
		expect(form.values.value).toEqual({ name: "Submitted", note: "Remote" });
		expect(registry.get(form.dirty)).toBe(true);
		form.revert();
		expect(form.values.value).toEqual({ name: "First", note: "Remote" });
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a resubmission after a refresh accepts only the latest submitted values", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const started = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		let calls = 0;
		const form = Form.make(Name, {
			initialValues: { name: "First" },
			onSubmit: (value) => (calls++ === 0 ? gated(started, release)(value) : Effect.succeed(value)),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		form.change("name", "One");
		registry.set(form.submit, undefined);
		yield* Deferred.await(started);
		form.receive({ name: "Remote" });
		form.change("name", "Two");
		registry.set(form.submit, undefined);
		expect(
			yield* AtomRegistry.getResult(registry, form.submit, {
				suspendOnWaiting: true,
			}),
		).toEqual({ name: "Two" });
		expect(registry.get(form.dirty)).toBe(false);
		form.change("name", "Remote");
		expect(registry.get(form.dirty)).toBe(true);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);
