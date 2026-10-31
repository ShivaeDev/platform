export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

export function itemIdCopy(id: string, onCopy: (result: "copied" | "failed") => void): () => void {
	return () => {
		void copyText(id).then((copied) => onCopy(copied ? "copied" : "failed"));
	};
}
