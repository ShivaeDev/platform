import type { Document } from "#browser/document/schema.ts";
import { DocumentAttention } from "./DocumentAttention.tsx";
import { DocumentClaims } from "./DocumentClaims.tsx";
import { DocumentCriteria } from "./DocumentCriteria.tsx";
export function DocumentEvidence({ document }: { readonly document: Document }) {
	return (
		<>
			<DocumentCriteria document={document} />
			<DocumentAttention document={document} />
			<DocumentClaims document={document} />
		</>
	);
}
