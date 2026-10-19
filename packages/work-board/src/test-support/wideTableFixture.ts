export const WIDE_TABLE = `| Criterion | Share | Evidence | Remaining |
| --- | --- | --- | --- |
| react | ~85% | Every Board view renders in React and the legacy main view is gone. | Answer and handoff forms are still bound in the DOM. |
| adoption, Board | ~80% | The local RPC guard and client folders are merged with tests. | The server is hand-written instead of the app host. |
`;

export const WIDE_TABLE_LAYOUT = {
	columns: [
		["Criterion", "one line"],
		["Share", "one line"],
		["Evidence", "readable width"],
		["Remaining", "readable width"],
	],
	scrolls: true,
};
