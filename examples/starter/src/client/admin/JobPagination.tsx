import { Option } from "effect";
import { Button } from "#client/ui/button.tsx";

export function JobPagination({
	cursors,
	next,
	pending,
	change,
}: {
	readonly cursors: readonly string[];
	readonly next: Option.Option<string>;
	readonly pending: boolean;
	readonly change: (cursors: readonly string[]) => void;
}) {
	function handleClick() {
		if (Option.isSome(next)) {
			change([...cursors, next.value]);
		}
	}
	return (
		<div className="flex items-center gap-3">
			<Button disabled={cursors.length === 0 || pending} onClick={() => change(cursors.slice(0, -1))} variant="outline">
				Previous
			</Button>
			<span className="text-sm">Page {cursors.length + 1}</span>
			<Button disabled={Option.isNone(next) || pending} onClick={handleClick} variant="outline">
				Next
			</Button>
		</div>
	);
}
