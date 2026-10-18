import { useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { act, useState } from "react";
import { screenDriver } from "@shivaedev/test-story/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { render } from "#client/testing.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

export const driverScreen = storyKit({
	clock: "live",
	*create() {
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(null)),
			(screen) => Effect.promise(screen.unmount),
		);
		const pending = Atom.make(false);
		const title = Atom.make("Ready");
		const response = Promise.withResolvers<string>();
		let delivery: ReturnType<typeof setTimeout> | undefined;
		yield* Effect.addFinalizer(() => Effect.sync(() => clearTimeout(delivery)));
		function handleClick() {
			view.registry.set(pending, true);
			void response.promise.then((next) => {
				view.registry.set(title, next);
				view.registry.set(pending, false);
			});
		}
		function Screen() {
			const text = useAtomValue(title);
			const busy = useAtomValue(pending);
			const [draft, setDraft] = useState("");
			return (
				<>
					<h1>{text}</h1>
					<input onInput={(event) => setDraft(event.currentTarget.value)} value={draft} />
					<output>{draft}</output>
					<button disabled={busy} onClick={handleClick} type="button">
						Load
					</button>
				</>
			);
		}
		yield* Effect.promise(() => view.render(<Screen />));
		return {
			deliver: (text: string) => {
				delivery = setTimeout(() => response.resolve(text), 20);
			},
			pending,
			view,
		};
	},
	inspect: ({ pending, view }) => ({ pending: view.registry.get(pending), screen: view.container.innerText }),
	name: "React screen driver",
	stages: ["screen"],
	verbs: ({ pending, deliver, view }, story) => ({
		...screenDriver({
			act: async (action) => {
				await act(action);
			},
			pending: () => view.registry.get(pending),
			root: view.container,
			tell: story.tell,
		}),
		deliverTitle: (title: string) =>
			Effect.sync(() => {
				story.tell(`the response delivers ${title}`);
				deliver(title);
			}),
	}),
});
