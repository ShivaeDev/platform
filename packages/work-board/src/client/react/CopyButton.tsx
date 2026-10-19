import { Copy } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "#client/react/components/ui/button.tsx";

export function CopyButton({ children = "Copy", ...props }: Omit<ComponentProps<typeof Button>, "type">) {
	return (
		<Button type="button" variant="outline" {...props}>
			<Copy aria-hidden="true" data-icon="inline-start" />
			{children}
		</Button>
	);
}
