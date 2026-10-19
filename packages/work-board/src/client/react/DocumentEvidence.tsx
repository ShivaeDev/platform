import type { Document } from "#browser/document/schema.ts";
import { criteriaInBody } from "./criteriaInBody.ts";
import { DocumentClaims } from "./DocumentClaims.tsx";
import { DocumentCriteria } from "./DocumentCriteria.tsx";
export function DocumentEvidence({ document }: { readonly document: Document }) {
	return (
		<>
			{document.metadata.kind !== "project" && !criteriaInBody(document) && <DocumentCriteria document={document} />}
			<DocumentClaims document={document} />
		</>
	);
}
