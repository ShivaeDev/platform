import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { type ReactNode, useEffect, useState } from "react";

export function SessionSignOut({
	action,
	children,
	recheck,
	wipe,
}: {
	readonly action: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>;
	readonly children?: ReactNode;
	readonly recheck: () => void;
	readonly wipe: () => void;
}): ReactNode {
	const result = useAtomValue(action);
	const [held, hold] = useState(false);
	const blocked = result.waiting || (held && !AsyncResult.isFailure(result));
	if (held !== blocked) {
		hold(blocked);
	}
	useEffect(() => {
		if (held && AsyncResult.isSuccess(result) && !result.waiting) {
			wipe();
			recheck();
		}
	}, [held, result, recheck, wipe]);
	return blocked ? null : children;
}
