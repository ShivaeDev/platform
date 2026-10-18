import { useState } from "react";
import { LabelledSwitch } from "#client/LabelledSwitch.tsx";

export function SwitchScreen({ label, disabled }: { readonly label: string; readonly disabled: boolean }) {
	const [checked, setChecked] = useState(false);
	return <LabelledSwitch checked={checked} disabled={disabled} label={label} onCheckedChange={setChecked} />;
}
