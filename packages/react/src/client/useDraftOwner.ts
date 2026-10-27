import { useInsertionEffect, useRef, useState } from "react";
import { type DraftSession, draftSession } from "@shivaedev/form/draftSession.ts";

interface DraftOwner {
	readonly activate: () => void;
	readonly session: DraftSession;
}

function owner(id: string, active: boolean): DraftOwner {
	const session = draftSession(id);
	let committed = active;
	return {
		activate: () => {
			committed = true;
		},
		session: {
			...session,
			get active() {
				return committed && session.active;
			},
		},
	};
}

export function useDraftOwner(id: string | undefined): DraftSession | undefined {
	const [held, hold] = useState(() => (id === undefined ? undefined : owner(id, true)));
	const committedRef = useRef(held);
	let current = held;
	if (current?.session.id !== id) {
		current = id === undefined ? undefined : owner(id, committedRef.current === undefined);
		hold(current);
	}
	// Insertion effects also run for Activity commits while layout and passive effects are disconnected.
	useInsertionEffect(() => {
		if (committedRef.current !== current) {
			committedRef.current?.session.drop();
			current?.activate();
			committedRef.current = current;
		}
	}, [current]);
	return current?.session;
}
