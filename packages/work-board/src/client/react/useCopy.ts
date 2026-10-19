import { useRef, useState } from "react";

async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

export function useCopy<TField extends HTMLInputElement | HTMLTextAreaElement>(
	text: string,
	{
		copied,
		initial = "",
		onStatus,
		reveal,
		selected,
	}: {
		readonly copied: string;
		readonly initial?: string;
		readonly onStatus?: ((text: string) => void) | undefined;
		readonly reveal?: () => void;
		readonly selected: string;
	},
) {
	const fieldRef = useRef<TField>(null);
	const [status, setState] = useState(initial);
	const setStatus = onStatus ?? setState;
	async function handleCopy() {
		if (await copyText(text)) {
			setStatus(copied);
			return;
		}
		reveal?.();
		fieldRef.current?.focus();
		fieldRef.current?.select();
		setStatus(`Couldn't copy automatically. The ${selected} is selected, so copy it yourself.`);
	}
	return { fieldRef, handleCopy, status };
}
