import { useRef, useState } from "react";
export function HandoffPrompt({ id, prompt, prepared = false }: { readonly id: string; readonly prompt: string; readonly prepared?: boolean }) {
	const ref = useRef<HTMLTextAreaElement>(null);
	const [status, setStatus] = useState(
		prepared
			? "Prepared; receipt not confirmed. Copy the prompt to your agent."
			: "Copy and paste this into your agent session. Preparing a file does not notify an agent.",
	);
	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(prompt);
			setStatus("Prompt copied. Paste it into your existing agent session.");
		} catch {
			ref.current?.focus();
			ref.current?.select();
			setStatus("Clipboard unavailable. The prompt is selected; copy it manually.");
		}
	}
	return (
		<div className="handoff-copy">
			<label>
				Prompt for your existing agent session
				<textarea id={`handoff-prompt-${id}`} readOnly ref={ref} rows={3} value={prompt} />
			</label>
			<button data-handoff-copy={`handoff-prompt-${id}`} onClick={handleCopy} type="button">
				Copy tiny prompt
			</button>
			<p data-copy-status role="status">
				{status}
			</p>
		</div>
	);
}
