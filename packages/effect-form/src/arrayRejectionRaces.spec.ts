import { expect } from "@effect/vitest";
import { Deferred, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { make } from "#form.ts";
import { it } from "#test/registry.ts";

const Answers = Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.String })) });
const first = { id: "first", text: "Same" };
const second = { id: "second", text: "Same" };
const runtime = Atom.runtime(Layer.empty);

it("a late rejection addresses its submitted key after reorder during a save", function* (registry) {
	const started = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const form = make(Answers, {
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [first, second] },
		onSubmit: (_values, submitter) =>
			Deferred.succeed(started, undefined).pipe(
				Effect.andThen(Deferred.await(release)),
				Effect.andThen(submitter.fail(["answers", 1, "text"], "Rejected")),
			),
		runtime,
	});
	registry.mount(form.errorAt(["answers", 0, "text"]));
	registry.set(form.submit, undefined);
	yield* Deferred.await(started);
	form.change("answers", [{ ...second }, { ...first }]);
	yield* Deferred.succeed(release, undefined);
	yield* Effect.flip(AtomRegistry.getResult(registry, form.submit, { suspendOnWaiting: true }));
	expect(registry.get(form.errorAt(["answers", 0, "text"]))).toBe("Rejected");
	expect(registry.get(form.errorAt(["answers", 1, "text"]))).toBeUndefined();
	form.field("answers").set([first]);
	expect(registry.get(form.errorAt(["answers", 0, "text"]))).toBeUndefined();
	form.field("answers").set([second, first]);
	expect(registry.get(form.errorAt(["answers", 0, "text"]))).toBeUndefined();
});

it.each(["edit", "remove", "replace"] as const)("a late rejection does not attach after %s of the submitted element", function* (kind, registry) {
	const started = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const form = make(Answers, {
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [first, second] },
		onSubmit: (_values, submitter) =>
			Deferred.succeed(started, undefined).pipe(
				Effect.andThen(Deferred.await(release)),
				Effect.andThen(submitter.fail(["answers", 1, "text"], "Rejected")),
			),
		runtime,
	});
	registry.mount(form.errorAt(["answers", 1, "text"]));
	registry.set(form.submit, undefined);
	yield* Deferred.await(started);
	form.change("answers", kind === "remove" ? [first] : [first, kind === "edit" ? { ...second, text: "New" } : { id: "replacement", text: "Same" }]);
	yield* Deferred.succeed(release, undefined);
	yield* Effect.flip(AtomRegistry.getResult(registry, form.submit, { suspendOnWaiting: true }));
	expect(registry.get(form.errorAt(["answers", 0, "text"]))).toBeUndefined();
	expect(registry.get(form.errorAt(["answers", 1, "text"]))).toBeUndefined();
	expect(registry.get(form.error("answers"))).toBeUndefined();
});

it("received values and revert rebase current rejections and duplicate keys do not guess a target", function* (registry) {
	const form = make(Answers, {
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [first, second] },
		onSubmit: (_values, submitter) => submitter.fail(["answers", 1, "text"], "Rejected"),
		runtime,
	});
	registry.mount(form.errorAt(["answers", 1, "text"]));
	registry.set(form.submit, undefined);
	yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
	form.receive({ answers: [{ ...second }, { ...first }] });
	expect(registry.get(form.errorAt(["answers", 0, "text"]))).toBe("Rejected");
	form.change("answers", [first, second]);
	expect(registry.get(form.errorAt(["answers", 1, "text"]))).toBe("Rejected");
	form.revert();
	expect(registry.get(form.errorAt(["answers", 0, "text"]))).toBe("Rejected");
	form.change("answers", [second, { ...second }]);
	expect(registry.get(form.errorAt(["answers", 0, "text"]))).toBeUndefined();
	expect(registry.get(form.errorAt(["answers", 1, "text"]))).toBeUndefined();
});
