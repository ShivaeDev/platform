import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
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
