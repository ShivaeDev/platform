import type { ComponentProps } from "react";

export function JobButton(props: ComponentProps<"button">) {
	return <button className="max-w-full rounded-md border px-3 py-2 wrap-anywhere whitespace-normal disabled:opacity-50" type="button" {...props} />;
}
