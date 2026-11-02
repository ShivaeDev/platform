import type { AnyRouter } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

export interface ScreenPendingOptions {
	readonly router?: AnyRouter | undefined;
}

export function screenPending({ router }: ScreenPendingOptions = {}): Effect.Effect<() => boolean, never, AtomRegistry.AtomRegistry> {
	return Effect.map(
		Effect.service(AtomRegistry.AtomRegistry),
		(registry) => () => routing(router) || [...registry.getNodes().values()].some((node) => waiting(node) && observed(node, new Set())),
	);
}

function routing(router: AnyRouter | undefined): boolean {
	return router !== undefined && (router.state.isLoading || router.state.matches.some((match) => match.isFetching !== false));
}

function waiting(node: AtomRegistry.Node<unknown>): boolean {
	return Option.match(node.valueOption(), { onNone: () => false, onSome: (value) => AsyncResult.isAsyncResult(value) && value.waiting });
}

// An idle dependent keeps its edge to a parent until the idle window removes it, so only a listener proves a reader.
function observed(node: AtomRegistry.Node<unknown>, visited: Set<AtomRegistry.Node<unknown>>): boolean {
	if (node.listeners.size > 0) {
		return true;
	}
	visited.add(node);
	return [...node.children].some((child) => !visited.has(child) && observed(child, visited));
}
