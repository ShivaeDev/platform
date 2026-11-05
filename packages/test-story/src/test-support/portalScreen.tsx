import { useAtomValue } from "@effect/atom-react";
import { Deferred, Effect, Fiber } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { act } from "react";
import { createPortal } from "react-dom";
import { expectNoReactWarnings, render } from "#client/adapters/react.ts";
import { screenDriver } from "#server/screenDriver.ts";
import { storyKit } from "#server/storyKit.ts";

expectNoReactWarnings();

export const portalScreen = storyKit({
	clock: "test",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(null)),
			(mounted) => Effect.promise(mounted.unmount),
		);
		const response = yield* Deferred.make<string>();
		const sampled = yield* Deferred.make<void>();
		const pending = Atom.make(false);
		const contents = Atom.make("Ready");
		const load = yield* Deferred.make<void>();
		yield* Effect.gen(function* () {
			yield* Deferred.await(load);
			const next = yield* Deferred.await(response);
			view.registry.set(contents, next);
			view.registry.set(pending, false);
		}).pipe(Effect.forkScoped);
		function Sheet() {
			const text = useAtomValue(contents);
			const busy = useAtomValue(pending);
			return createPortal(
				<section aria-busy={busy} aria-label="News sheet" role="dialog">
					<p>{text}</p>
				</section>,
				document.body,
			);
		}
		yield* Effect.promise(() =>
			view.render(
				<main>
					<button
						onClick={() => {
							view.registry.set(pending, true);
							Deferred.doneUnsafe(load, Effect.void);
						}}
						type="button"
					>
						Load news
					</button>
					<Sheet />
				</main>,
			),
		);
		return { pending, response, sampled, view };
	},
	inspect: ({ view }) => view.container.ownerDocument.body.innerHTML,
	name: "portal screen settling",
	stages: [],
	verbs: ({ pending, response, sampled, view }, story) => {
		let waiting = false;
		const screen = screenDriver({
			act: async (action) => {
				await act(async () => {
					const completed = action();
					if (waiting) {
						Deferred.doneUnsafe(sampled, Effect.void);
					}
					await completed;
				});
			},
			pending: () => {
				const busy = view.registry.get(pending);
				waiting = busy;
				return busy;
			},
			root: view.container,
			tell: story.tell,
		});
		return {
			...screen,
			deliver: (text: string) => Deferred.succeed(response, text),
			startSettling: () =>
				Effect.gen(function* () {
					const settling = yield* screen.settle().pipe(Effect.forkScoped({ startImmediately: true }));
					yield* Deferred.await(sampled);
					return Fiber.join(settling);
				}),
		};
	},
});
