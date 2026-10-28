import type { SeedFile } from "./tree.ts";

export const jsxDecisions: SeedFile = {
	content: [
		"const And = () => <div>{count && <X />}</div>;",
		"const Nullable = () => <>{ready ? <X /> : null}</>;",
		"const Either = () => <div>{ready ? <X /> : <Y />}</div>;",
		"const Nested = () => <div>{loading ? <X /> : ready ? <Y /> : null}</div>;",
		"const Mixed = () => <div>{ready && (other ? <X /> : null)}</div>;",
		"const Items = () => <ul>{items.map(item => item.visible ? <li /> : null)}</ul>;",
		"const Leaked = () => <div>{count && label}</div>;",
		"const Block = () => <ul>{items.map(item => { return item.visible && <li />; })}</ul>;",
		"const Child = () => <ul>{items.map(item => <li>{item.visible && <X />}</li>)}</ul>;",
	].join("\n"),
	path: "src/decisions.tsx",
};

export const jsxAccepted: SeedFile = {
	content: [
		"function Early({ ready }) { if (!ready) return null; return <X />; }",
		"function Computed({ ready }) { const content = ready ? <X /> : <Y />; return <div>{content}</div>; }",
		"function Optional({ item }) { if (!item) return null; return <span>{item.name}</span>; }",
		"const Items = ({ items }) => <ul>{items.map(item => <Item key={item.id} item={item} />)}</ul>;",
		"function Item({ item }) { if (!item.visible) return null; return <li>{item.name}</li>; }",
		'const Styled = ({ ready }) => <div className={ready ? "active" : "idle"} title={ready && "ready"} />;',
		"const Wrapped = ({ ready }) => <Frame content={ready ? <X /> : null} />;",
	].join("\n"),
	path: "src/accepted.tsx",
};

export const jsxDecision: SeedFile = { content: "const View = () => <div>{ready ? <X /> : null}</div>;", path: "src/accepted.tsx" };

export const jsxJavascript: SeedFile = { content: "const View = () => <div>{ready && <X />}</div>;", path: "src/view.jsx" };
