import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "#client/react/components/ui/button.tsx";

function ClearConfirm({ count, onCancel, onClear }: { readonly count: number; readonly onCancel: () => void; readonly onClear: () => void }) {
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => cancelRef.current?.focus(), []);
	return (
		<fieldset className="m-0 grid w-full gap-2 border-0 p-0">
			<legend className="mb-2 p-0 text-muted-foreground text-xs">
				Remove {count === 1 ? "1 entry" : `${count} entries`} from history? Pinned documents stay.
			</legend>
			<div className="flex gap-2">
				<Button onClick={onCancel} ref={cancelRef} size="sm" type="button" variant="outline">
					Cancel
				</Button>
				<Button onClick={onClear} size="sm" type="button" variant="destructive">
					Clear
				</Button>
			</div>
		</fieldset>
	);
}

export function ClearHistory({
	count,
	confirming,
	onConfirmingChange,
	onClear,
}: {
	readonly count: number;
	readonly confirming: boolean;
	readonly onConfirmingChange: (confirming: boolean) => void;
	readonly onClear: () => void;
}) {
	function handleCancel() {
		onConfirmingChange(false);
	}
	function handleStart() {
		onConfirmingChange(true);
	}
	if (confirming) {
		return <ClearConfirm count={count} onCancel={handleCancel} onClear={onClear} />;
	}
	return (
		<Button onClick={handleStart} size="sm" type="button" variant="ghost">
			<Trash2 aria-hidden="true" />
			Clear history
		</Button>
	);
}
