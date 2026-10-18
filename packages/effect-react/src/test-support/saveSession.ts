import { Data, Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { act, createElement } from "react";
import { useField } from "@shivaedev/effect-form/react.ts";
import { type Create, useCreate } from "#create.ts";
import { type Editor, useEditor } from "#editor.ts";
import { SessionBoundary } from "#session-boundary.ts";
import type { Rendered } from "#testing.ts";

export class Unauthorized extends Data.TaggedError("Unauthorized")<{ readonly message: string }> {}

const Name = Schema.Struct({ name: Schema.String });
type Name = typeof Name.Type;
const runtime = Atom.runtime(Layer.empty);
const query = Atom.make(AsyncResult.success({ name: "Saved order" }));
interface Held {
	current?: Create<typeof Name.fields, never, Unauthorized, never> | Editor<typeof Name.fields, Name, never, Unauthorized, never>;
}

interface ProbeProps {
	readonly denied: Unauthorized;
	readonly held: Held;
}

function CreateProbe({ held, denied }: ProbeProps) {
	held.current = useCreate({ create: (_values: Name) => Effect.fail(denied), fields: Name, initialValues: { name: "" }, runtime });
	return createElement(SaveControls, { held });
}

function EditorProbe({ held, denied }: ProbeProps) {
	held.current = useEditor({ fields: Name, query, runtime, save: (_values: Name) => Effect.fail(denied), values: (row) => row });
	return createElement(SaveControls, { held });
}

function SaveControls({ held }: { readonly held: Held }) {
	const current = held.current;
	if (!current?.form) {
		throw new Error("No save form");
	}
	const name = useField(current.form, "name");
	return createElement(
		"section",
		null,
		createElement("input", {
			name: "name",
			onChange: (event: React.ChangeEvent<HTMLInputElement>) => name.onChange(event.target.value),
			value: name.value,
		}),
		createElement("button", { onClick: current.save, type: "button" }, "Save"),
		createElement("output", null, JSON.stringify({ dirty: current.dirty, failure: current.failure, saving: current.saving })),
	);
}
export async function saveSession(view: Rendered, kind: "create" | "editor") {
	const denied = new Unauthorized({ message: "Session expired before saving" });
	const rechecks: string[] = [];
	const held: Held = {};
	const boundary = {
		children: () => createElement(kind === "create" ? CreateProbe : EditorProbe, { denied, held }),
		connect: () => undefined,
		identify: (session: string) => session,
		recheck: () => rechecks.push("expired-session"),
		session: "expired-session",
	};
	function render() {
		return act(async () => {
			await view.render(createElement(SessionBoundary<string, undefined>, boundary));
			await Promise.resolve();
		});
	}
	await render();
	function current() {
		if (held.current === undefined) {
			throw new Error("Save hook did not render");
		}
		return held.current;
	}
	return {
		close: view.unmount,
		container: view.container,
		current,
		denied,
		form: () => {
			const form = current().form;
			if (form === undefined) {
				throw new Error("Editor form did not initialize");
			}
			return form;
		},
		rechecks,
		render,
	};
}
