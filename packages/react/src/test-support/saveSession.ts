import { Data, Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { act, createElement } from "react";
import { useField } from "@shivaedev/form/client/react.ts";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { type Create, useCreate } from "#client/create.ts";
import { type Editor, useEditor } from "#client/editor.ts";
import { UnstableSession } from "./UnstableSession.tsx";

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
	readonly dies: boolean;
	readonly held: Held;
}

function CreateProbe({ held, denied, dies }: ProbeProps) {
	held.current = useCreate({
		create: (_values: Name) => (dies ? Effect.die(new Error("Save died")) : Effect.fail(denied)),
		fields: Name,
		initialValues: { name: "" },
		runtime,
	});
	return createElement(SaveControls, { held });
}

function EditorProbe({ held, denied, dies }: ProbeProps) {
	held.current = useEditor({
		fields: Name,
		query,
		runtime,
		save: (_values: Name) => (dies ? Effect.die(new Error("Save died")) : Effect.fail(denied)),
		values: (row) => row,
	});
	return createElement(SaveControls, { held });
}

function statusOf({ dirty, saving }: { readonly dirty: boolean; readonly saving: boolean }) {
	if (saving) {
		return "Saving";
	}
	return dirty ? "Unsaved changes" : "Saved";
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
		Option.isSome(current.cause) ? createElement("p", { role: "alert" }, "created" in current ? "Could not create" : "Could not save") : null,
		createElement("output", null, statusOf(current)),
		Option.match(current.failure, {
			onNone: () => null,
			onSome: (failure) => createElement("p", { "data-failure": "" }, `${failure.name}: ${failure.message}`),
		}),
	);
}
export async function saveSession(view: Rendered, kind: "create" | "editor", dies = false) {
	const denied = new Unauthorized({ message: "Session expired before saving" });
	const rechecks: string[] = [];
	const held: Held = {};
	function render() {
		return act(async () => {
			await view.render(
				createElement(
					UnstableSession,
					{
						onRecheck: () => {
							rechecks.push("expired-session");
						},
					},
					createElement(kind === "create" ? CreateProbe : EditorProbe, { denied, dies, held }),
				),
			);
			await Promise.resolve();
		});
	}
	await render();
	return { container: view.container, rechecks, render };
}
