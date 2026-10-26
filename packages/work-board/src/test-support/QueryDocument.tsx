import { Option } from "effect";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { DocumentView } from "#client/document/View.ts";
import { DocumentPage } from "#client/react/DocumentPage.tsx";
import type { BoardTestApi } from "./react.tsx";

export function QueryDocument({ api, url, plain = false }: { readonly api: BoardTestApi; readonly url: string; readonly plain?: boolean }) {
	const query = useQuery(api.document.query({ url }));
	return Option.match(query.data, {
		onNone: () => null,
		onSome: (data) => (plain ? <DocumentView document={data} /> : <DocumentPage document={data} />),
	});
}

export function QueryPlainBoard({ api, url }: { readonly api: BoardTestApi; readonly url: string }) {
	const query = useQuery(api.board.query({ url }));
	return Option.match(query.data, {
		onNone: () => null,
		onSome: (data) => <DocumentView board={data.counts} document={data.document} />,
	});
}
