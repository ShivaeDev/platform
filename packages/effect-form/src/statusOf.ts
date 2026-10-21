import { Equal } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRef from "effect/reactivity/AtomRef";
import type { FieldMessages } from "./messages.ts";
import { asPath, type KeySelectors, type PathMessage, retainedPath } from "./paths.ts";
import { fromRef } from "./refs.ts";
import type { Path } from "./shape.ts";

interface State {
	readonly failures: readonly PathMessage[];
	readonly submitted: boolean;
	readonly touched: Readonly<Record<string, true>>;
}

export function statusOf() {
	const state = AtomRef.make<State>({
		failures: [],
		submitted: false,
		touched: {},
	});
	const paths = fromRef(state.prop("failures"));
	return {
		attempt: (): void => {
			state.update((current) => ({
				...current,
				failures: [],
				submitted: true,
			}));
		},
		failures: Atom.map(paths, (entries): FieldMessages => {
			const messages: Record<string, string> = Object.create(null);
			for (const { path, message } of entries) {
				if (!Object.hasOwn(messages, path[0])) {
					messages[path[0]] = message;
				}
			}
			return messages;
		}),
		note: (input: string | Path, message: string): void => {
			const path = asPath(input);
			state.update((current) => ({
				...current,
				failures: [...current.failures.filter((entry) => !Equal.equals(entry.path, path)), { message, path }],
			}));
		},
		paths,
		rebase: (previous: unknown, next: unknown, keys: KeySelectors): void => {
			state.update((current) => ({
				...current,
				failures: current.failures.flatMap((entry) => {
					const path = retainedPath(entry.path, previous, next, keys);
					return path === undefined ? [] : [{ ...entry, path }];
				}),
			}));
		},
		submitted: fromRef(state.prop("submitted")),
		touch: (name: string): void => {
			state.update((current) =>
				current.touched[name] === true && !current.failures.some((entry) => entry.path.length === 1 && entry.path[0] === name)
					? current
					: {
							...current,
							failures: current.failures.filter((entry) => entry.path.length !== 1 || entry.path[0] !== name),
							touched: { ...current.touched, [name]: true },
						},
			);
		},
		touched: fromRef(state.prop("touched")),
	};
}
