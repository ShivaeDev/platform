import { managedRequestReceipt } from "#attention/managedRequestReceipt.ts";
import { attentionSource } from "#attention/requests.ts";
import { identityUrl } from "#metadata/links.ts";
import type { MetadataModel } from "#metadata/model.ts";
import type { ParsedMetadata } from "#metadata/parse.ts";
import { escapeHtml } from "./escape.ts";
import { referenceHtml } from "./metadataLinks.ts";

export function attentionDetails(parsed: ParsedMetadata, file: string, model: MetadataModel): string {
	const requests = parsed.fields.attention ?? [];
	if (requests.length === 0) {
		return "";
	}
	return `<h3>Recorded attention requests</h3><p>Open/closed is source state. Closing a request does not establish acceptance or record an answer.</p><ul>${requests
		.map((request, index) => {
			const receipt = managedRequestReceipt({ file, parsed }, request, model);
			const acknowledged = receipt
				? `<p>Managed request acknowledged: ${receipt.disposition}. Source state remains ${escapeHtml(request.state)}. This receipt does not establish acceptance.</p><p>Reviewed question: ${referenceHtml(receipt.question, receipt.question, model)}</p>`
				: "";
			const respond = receipt
				? ""
				: `<a href="/_board/respond?item=${encodeURIComponent(parsed.fields.id ?? "")}&amp;request=${encodeURIComponent(request.id)}">Respond to this request</a> · `;
			return `<li id="${attentionSource({ file, parsed }, index)}" tabindex="-1"><b>${escapeHtml(request.kind)} · ${escapeHtml(request.id)} · ${escapeHtml(request.state)}</b>${acknowledged}<p>${escapeHtml(request.reason)}</p><p>Response needed from: ${request.responseFrom.map(escapeHtml).join(", ")}</p><p>Recorded to unblock: ${request.unblocks.map((target) => referenceHtml(target, target, model)).join(", ")}</p><p>${respond}<a href="${identityUrl(parsed.fields.id ?? "")}">Reviewed item</a></p><p>Source: ${escapeHtml(file)}:${parsed.lines[`attention.${index}`] ?? parsed.lines.attention ?? 2}</p></li>`;
		})
		.join("")}</ul>`;
}
