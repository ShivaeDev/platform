import { useRef, useState } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Textarea } from "#client/react/components/ui/textarea.tsx";
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
			<Label className="mb-2 font-normal" htmlFor={`handoff-prompt-${id}`}>
				Prompt for your existing agent session
			</Label>
			<Textarea className="mb-2 font-mono" id={`handoff-prompt-${id}`} readOnly ref={ref} rows={3} value={prompt} />
			<Button data-handoff-copy={`handoff-prompt-${id}`} onClick={handleCopy} type="button">
				Copy tiny prompt
			</Button>
			<p data-copy-status role="status">
				{status}
			</p>
		</div>
	);
}
