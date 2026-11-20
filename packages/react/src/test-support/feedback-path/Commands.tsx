import { Effect } from "effect";
import { useMemo } from "react";
import { useAction } from "#client/resultState.ts";
import type { FeatureScreen } from "#test/feedback-path/view.tsx";

export function Commands({ state }: { readonly state: FeatureScreen }) {
	const { client } = state;
	const run = useMemo(
		() => (input: { readonly title: string }) => {
			const effect = client.api.remove.run(input);
			return (state.uninterruptible ? Effect.uninterruptible(effect) : effect).pipe(
				Effect.ensuring(Effect.sync(() => state.finished.push(input.title))),
			);
		},
		[client, state.uninterruptible, state.finished],
	);
	const remove = useAction(
		{ run, runtime: client.runtime },
		{
			concurrent: true,
			failures: { Rejected: () => ({ message: "Could not remove note" }) },
			notices: {
				onSuccess: (removed) => ({
					action: {
						label: `Undo ${removed.title}`,
						run: state.uninterruptible ? Effect.uninterruptible(client.api.restore.run(removed)) : client.api.restore.run(removed),
					},
					message: `Removed ${removed.title}`,
				}),
			},
			onSuccess: (removed) => state.callbacks.push(`${state.session}: ${removed.title}`),
		},
	);
	const edit = useAction(client.api.edit);
	return (
		<nav aria-label="Note commands">
			{["first", "second", "blocked"].map((title) => (
				<button key={title} onClick={() => remove.dispatch({ title })} type="button">
					Remove {title}
				</button>
			))}
			<button onClick={() => edit.dispatch({ title: "first" })} type="button">
				Edit first
			</button>
		</nav>
	);
}
