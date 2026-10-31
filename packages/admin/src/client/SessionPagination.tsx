import { Option } from "effect";
import type { SessionList, SessionListInput } from "@shivaedev/identity/sessions.ts";

type Cursor = NonNullable<typeof SessionListInput.Type.cursor>;

export function SessionPagination({
	data,
	cursors,
	pending,
	go,
}: {
	readonly data: typeof SessionList.Type | undefined;
	readonly cursors: readonly Cursor[];
	readonly pending: boolean;
	readonly go: (cursors: readonly Cursor[]) => void;
}) {
	if (data === undefined) {
		return null;
	}
	return (
		<nav aria-label="Session pages" className="flex flex-wrap gap-3">
			<button
				className="rounded-md border px-3 py-2 disabled:opacity-50"
				disabled={cursors.length === 0 || pending}
				onClick={() => go(cursors.slice(0, -1))}
				type="button"
			>
				Previous sessions
			</button>
			<button
				className="rounded-md border px-3 py-2 disabled:opacity-50"
				disabled={Option.isNone(data.next) || pending}
				onClick={() => Option.map(data.next, (next) => go([...cursors, next]))}
				type="button"
			>
				Next sessions
			</button>
		</nav>
	);
}
