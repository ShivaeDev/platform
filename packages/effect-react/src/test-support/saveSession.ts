import { Data, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { type Create, useCreate } from "#create.ts";
import { SessionBoundary } from "#session-boundary.ts";

export class Unauthorized extends Data.TaggedError("Unauthorized")<{ readonly message: string }> {}

const Name = Schema.Struct({ name: Schema.String });
type Name = typeof Name.Type;
const runtime = Atom.runtime(Layer.empty);
interface Held {
	current?: Create<typeof Name.fields, never, Unauthorized, never>;
}

function SaveProbe({ held, denied }: { readonly held: Held; readonly denied: Unauthorized }) {
	held.current = useCreate({ create: (_values: Name) => Effect.fail(denied), fields: Name, initialValues: { name: "" }, runtime });
	return null;
}

export async function saveSession() {
	const container = document.createElement("div");
	const root = createRoot(container);
	const denied = new Unauthorized({ message: "Session expired before saving" });
	const rechecks: string[] = [];
	const held: Held = {};
	const boundary = {
		children: () => createElement(SaveProbe, { denied, held }),
		connect: () => undefined,
		identify: (session: string) => session,
		recheck: () => rechecks.push("expired-session"),
		session: "expired-session",
	};
	await act(async () => {
		root.render(createElement(SessionBoundary<string, undefined>, boundary));
		await Promise.resolve();
	});
	return {
		close: () => act(async () => root.unmount()),
		current: () => {
			if (held.current === undefined) {
				throw new Error("Create hook did not render");
			}
			return held.current;
		},
		denied,
		rechecks,
	};
}
