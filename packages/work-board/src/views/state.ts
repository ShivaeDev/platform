import { Option, Schema } from "effect";

const Sort = Schema.Literals(["title", "owner", "status"]);
export const State = Schema.Struct({
	board: Schema.String,
	item: Schema.String,
	owner: Schema.String,
	query: Schema.String,
	sort: Sort,
	status: Schema.String,
	view: Schema.Literal("board"),
});
export type State = typeof State.Type;

export function stateOf(url: string): State {
	const params = new URL(url, "http://127.0.0.1").searchParams;
	return {
		board: params.get("board") ?? "",
		item: params.get("item") ?? "",
		owner: params.get("owner") ?? "",
		query: (params.get("q") ?? "").slice(0, 200),
		sort: Option.getOrElse(Schema.decodeUnknownOption(Sort)(params.get("sort")), () => "title"),
		status: params.get("status") ?? "",
		view: "board",
	};
}
export function viewUrl(state: State, changes: Partial<State> = {}, hash = ""): string {
	const next = { ...state, ...changes };
	const params = new URLSearchParams({ view: next.view });
	for (const [key, value] of Object.entries({
		board: next.board,
		item: next.item,
		owner: next.owner,
		q: next.query,
		sort: next.sort,
		status: next.status,
	})) {
		if (value) {
			params.set(key, value);
		}
	}
	return `/_board/work?${params}${hash ? `#${hash}` : ""}`;
}
export function fieldFilter(value: string | undefined): string {
	return value === undefined ? "missing" : `value:${value}`;
}
