import { Option } from "effect";
import { JobButton } from "./JobButton.tsx";

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
		<div className="flex flex-wrap items-center gap-3">
			<JobButton disabled={cursors.length === 0 || pending} onClick={() => change(cursors.slice(0, -1))}>
				Previous
			</JobButton>
			<span className="text-sm">Page {cursors.length + 1}</span>
			<JobButton disabled={Option.isNone(next) || pending} onClick={handleClick}>
				Next
			</JobButton>
		</div>
	);
}
