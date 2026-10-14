import { Settings } from "lucide-react";
import type { ReactNode } from "react";
import { Popover } from "#client/react/components/ui/Popover.tsx";
import { shellIds } from "./shellIds.ts";
import type { AppearanceControls } from "./useAppearance.ts";
export function SettingsPopover({ appearance, updates }: { readonly appearance: AppearanceControls; readonly updates: ReactNode }) {
	return (
		<Popover label="Settings" trigger={<Settings aria-hidden="true" />} triggerId="settings-open">
			<fieldset aria-label="Reading preferences" className="m-0 grid gap-4 border-0 p-0">
				<legend className="mb-3 font-semibold">Settings</legend>
				<label className="grid gap-1" htmlFor={shellIds.theme}>
					Theme
					<select
						className="h-9 rounded-md border bg-background px-2 text-foreground"
						id={shellIds.theme}
						onChange={(event) => appearance.change({ theme: event.target.value })}
						value={appearance.theme}
					>
						<option value="system">System</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
				</label>
				<label className="grid gap-1" htmlFor={shellIds.density}>
					Density
					<select
						className="h-9 rounded-md border bg-background px-2 text-foreground"
						id={shellIds.density}
						onChange={(event) => appearance.change({ density: event.target.value })}
						value={appearance.density}
					>
						<option value="comfortable">Comfortable</option>
						<option value="compact">Compact</option>
					</select>
				</label>
				{updates}
				<span className="text-muted-foreground text-xs empty:hidden" id={shellIds.preferenceStatus} role="status">
					{appearance.notice}
				</span>
			</fieldset>
		</Popover>
	);
}
