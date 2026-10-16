import type { Document } from "#browser/document/schema.ts";
import { DocumentClaims } from "./DocumentClaims.tsx";
import { DocumentCriteria } from "./DocumentCriteria.tsx";
export function DocumentEvidence({ document }: { readonly document: Document }) {
	return (
		<>
			{document.metadata.kind !== "project" && <DocumentCriteria document={document} />}
			<DocumentClaims document={document} />
		</>
	);
}
