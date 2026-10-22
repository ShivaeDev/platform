// Mirrors only the subset of Claude Code's mod API this plugin uses; update it by hand when that API changes.

declare module "claude-code" {
	interface PluginState {}
	interface McpToolInputs {}

	type RenderChildren = RenderNode | number | boolean | null | undefined | readonly RenderChildren[];
	type RenderNode = RenderElement | string;
	interface RenderElement {
		props: Readonly<Record<string, unknown>>;
		type: string;
	}
	type ElementConstructor<TProps> = (props: TProps & { children?: RenderChildren; key?: string }) => RenderElement;
	type Color = string;
	type Space = number | "xs" | "sm" | "md" | "lg" | "xl";

	interface BoxProps {
		alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
		columnGap?: Space;
		flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
		flexGrow?: number;
		flexShrink?: number;
		flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
		gap?: Space;
		justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly";
		width?: number | string;
	}
	interface TextProps {
		color?: Color;
		dimColor?: boolean;
		size?: "caption" | "footnote" | "body" | "heading" | "title";
		tabular?: boolean;
		weight?: "regular" | "medium" | "semibold" | "bold";
		wrap?: "wrap" | "truncate-end";
	}
	interface ButtonProps {
		label: string;
		onPress: () => void;
		plain?: true;
	}
	interface SharedElements {
		Box: ElementConstructor<BoxProps>;
		Button: ElementConstructor<ButtonProps>;
		Link: ElementConstructor<{ href: string; label?: string }>;
		Text: ElementConstructor<TextProps>;
	}
	interface DrawnElements extends SharedElements {
		Svg: ElementConstructor<{ alt: string; height?: number; source: string; width?: number }>;
	}
	interface Elements {
		desktop: DrawnElements;
		mobile: DrawnElements;
		terminal: SharedElements;
		vscode: DrawnElements;
	}
	type RenderSurface = keyof Elements;

	interface HttpResponse {
		headers: Record<string, string>;
		ok: boolean;
		status: number;
		text: string;
	}
	type UiOpenResult = { isPlaced: true } | { isPlaced: false; reason: string };
	interface ToolSpec {
		description: string;
		inputSchema?: Record<string, unknown>;
		isDeferred?: boolean;
		name: string;
	}

	interface EngineInterface {
		clock: { every: (ms: number, fn: () => void) => () => void; now: () => Promise<number> };
		command: { register: (command: { description: string; name: string }) => Promise<unknown> };
		fs: { stat: (path: string) => Promise<{ kind: "file" | "dir" | "other" }> };
		http: {
			fetch: (url: string, init?: { body?: string; headers?: Record<string, string>; method?: string; socketPath?: string }) => Promise<HttpResponse>;
		};
		process: { run: (argv: readonly string[]) => Promise<{ exitCode: number }> };
		session: { cwd: () => Promise<string> };
		tool: { register: (tool: ToolSpec) => Promise<unknown> };
		ui: {
			open: (pane: { focus?: boolean; id: string; title: string }) => Promise<UiOpenResult>;
			resolve: <E extends { surface: RenderSurface }>(e: E) => Elements[E["surface"]];
			toast: (text: string) => void;
		};
	}

	interface Render<TComponent extends string, TProps> {
		component: TComponent;
		props: TProps;
		requestId: string;
		surface: RenderSurface;
	}
	type PaneRender = Render<"Pane", { bodyColumns: number }>;
	type AbovePromptRender = Render<"AbovePrompt", { bodyColumns: number; hasSurvey: boolean }>;
	interface SessionStart {
		cwd: string;
		isInterready: boolean;
	}
	type ToolCall<T extends keyof McpToolInputs> = { tool: T; "tool_use_id": string } & McpToolInputs[T];
	type ToolAnswer = { deny: string } | { result: unknown };

	interface On {
		(
			pattern: "session.start",
			hook: ($: EngineInterface, e: SessionStart, next: (e: SessionStart) => Promise<{ cwd: string }>) => Promise<{ cwd: string }>,
		): void;
		(pattern: "command.run", matcher: { command: string }, hook: ($: EngineInterface) => Promise<{ text?: string }>): void;
		(
			pattern: "ui.render",
			matcher: { component: "Pane"; requestId: string },
			hook: ($: EngineInterface, e: PaneRender) => Promise<RenderElement>,
		): void;
		(
			pattern: "ui.render",
			matcher: { component: "AbovePrompt" },
			hook: ($: EngineInterface, e: AbovePromptRender, next: (e: AbovePromptRender) => Promise<RenderElement>) => Promise<RenderElement>,
		): void;
		<T extends keyof McpToolInputs>(
			pattern: "tool.call",
			matcher: { tool: T },
			hook: ($: EngineInterface, e: ToolCall<T>) => ToolAnswer | Promise<ToolAnswer>,
		): void;
	}
	type Register = (on: On) => unknown;

	interface Atom<T> {
		readonly initial: T;
	}
	function atom<TPlugin extends keyof PluginState & string, TKey extends keyof PluginState[TPlugin] & string>(
		ref: { readonly key: TKey; readonly plugin: TPlugin },
		initial: PluginState[TPlugin][TKey],
	): Atom<PluginState[TPlugin][TKey]>;
	function read<T>($: EngineInterface, source: Atom<T>): Promise<T>;
	function update<T>($: EngineInterface, target: Atom<T>, change: (value: T) => T): Promise<T>;
}

declare const h: (
	tag: (props: never) => import("claude-code").RenderNode | null | undefined,
	props: Record<string, unknown> | null | undefined,
	...children: unknown[]
) => import("claude-code").RenderElement;

declare namespace JSX {
	type Element = import("claude-code").RenderElement;
	type ElementType = (props: never) => import("claude-code").RenderNode | null | undefined;
	interface ElementChildrenAttribute {
		children: unknown;
	}
	interface IntrinsicAttributes {
		key?: string;
	}
}
