import { expect } from "@effect/vitest";
import { Data, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { make } from "#form.ts";
import { FieldFailure, Invalid } from "#shape.ts";
import { it } from "#test/registry.ts";

const runtime = Atom.runtime(Layer.empty);
const Answers = Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.NonEmptyString })) });
const first = { id: "first", text: "One" };
const second = { id: "second", text: "Two" };
const third = { id: "third", text: "" };

it("Schema errors follow their element through insertion, removal and reorder", function* (registry) {
	const form = make(Answers, {
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [first, second, third] },
		onSubmit: Effect.succeed,
		runtime,
	});
	function message(index: number) {
		return registry.get(form.errorAt(["answers", index, "text"]));
	}
	registry.mount(form.errorAt(["answers", 2, "text"]));
	expect(message(2)).toBeUndefined();
	registry.set(form.submit, undefined);
	expect(yield* Effect.flip(AtomRegistry.getResult(registry, form.submit))).toBeInstanceOf(Invalid);
	expect(message(0)).toBeUndefined();
	expect(message(1)).toBeUndefined();
	expect(message(2)).toBe("Required");
	form.change("answers", [{ id: "inserted", text: "New" }, first, second, third]);
	expect(message(2)).toBeUndefined();
	expect(message(3)).toBe("Required");
	form.change("answers", [second, { ...third }]);
	expect(message(0)).toBeUndefined();
	expect(message(1)).toBe("Required");
	form.change("answers", [{ ...third }, second]);
	expect(message(0)).toBe("Required");
	expect(message(1)).toBeUndefined();
	form.change("answers", [second]);
	expect(message(0)).toBeUndefined();
	expect(message(1)).toBeUndefined();
});

class AnswerRejected extends Data.TaggedError("AnswerRejected")<{ readonly index: number; readonly message: string }> {}

it("a typed server rejection follows the keyed answer and clears only when its input changes or disappears", function* (registry) {
	const form = make(Answers, {
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [first, second, { ...third, text: "Rejected" }] },
		onSubmit: (_values, submitter) =>
			Effect.fail(new AnswerRejected({ index: 2, message: "Answer is closed" })).pipe(
				Effect.catchTag("AnswerRejected", (reason) => submitter.fail(["answers", reason.index, "text"], reason.message)),
			),
		runtime,
	});
	function message(index: number) {
		return registry.get(form.errorAt(["answers", index, "text"]));
	}
	registry.mount(form.errorAt(["answers", 2, "text"]));
	registry.set(form.submit, undefined);
	const rejection = yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
	expect(rejection).toBeInstanceOf(FieldFailure);
	expect(rejection).toMatchObject({ path: "answers", segments: ["answers", 2, "text"] });
	expect(message(2)).toBe("Answer is closed");
	expect(registry.get(form.errorAt(["answers", 2]))).toBe("Answer is closed");
	expect(registry.get(form.errorAt(["answers", 2, "id"]))).toBeUndefined();
	expect(registry.get(form.error("answers"))).toBe("Answer is closed");
	const rejected = { id: "third", text: "Rejected" };
	form.change("answers", [{ id: "inserted", text: "Rejected" }, first, second, rejected]);
	expect(message(0)).toBeUndefined();
	expect(message(2)).toBeUndefined();
	expect(message(3)).toBe("Answer is closed");
	form.change("answers", [{ ...second, text: "Edited sibling" }, { ...rejected }]);
	expect(message(1)).toBe("Answer is closed");
	form.blur("answers");
	expect(message(1)).toBe("Answer is closed");
	form.change("answers", [{ ...rejected }, second]);
	expect(message(0)).toBe("Answer is closed");
	expect(message(1)).toBeUndefined();
	form.change("answers", [{ ...rejected, text: "Corrected" }, second]);
	expect(message(0)).toBeUndefined();
	form.change("answers", [rejected, second]);
	expect(message(0)).toBeUndefined();
	registry.set(form.submit, undefined);
	yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
	expect(message(2)).toBeUndefined();
});

it("unconfigured arrays retain index paths rather than guessing element identity", function* (registry) {
	const form = make(Answers, {
		initialValues: { answers: [first, { id: "second", text: "One" }] },
		onSubmit: (_values, submitter) => submitter.fail(["answers", 0, "text"], "Rejected"),
		runtime,
	});
	registry.mount(form.errorAt(["answers", 0, "text"]));
	registry.set(form.submit, undefined);
	yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
	form.change("answers", [{ id: "second", text: "One" }, first]);
	expect(registry.get(form.errorAt(["answers", 0, "text"]))).toBe("Rejected");
	expect(registry.get(form.errorAt(["answers", 1, "text"]))).toBeUndefined();
});
