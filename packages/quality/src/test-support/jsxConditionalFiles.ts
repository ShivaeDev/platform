const REPAIR =
	"Decide before the JSX with an if and early return, or a variable computed above the return; or extract a component that receives the data and returns null when it has nothing to show.";

export const CHILD_DECISION = `Conditional rendering inside a JSX child. ${REPAIR}`;

export const MAPPED_DECISION = `${CHILD_DECISION} Inside .map, extract the item into its own component that makes its own decision.`;

export const jsxDecisions = [
	{ code: "const And = () => <div>{count && <X />}</div>;", findings: [CHILD_DECISION], name: "a && element child" },
	{ code: "const Nullable = () => <>{ready ? <X /> : null}</>;", findings: [CHILD_DECISION], name: "a ternary to null inside a fragment" },
	{ code: "const Either = () => <div>{ready ? <X /> : <Y />}</div>;", findings: [CHILD_DECISION], name: "a ternary between two elements" },
	{
		code: "const Nested = () => <div>{loading ? <X /> : ready ? <Y /> : null}</div>;",
		findings: [CHILD_DECISION, CHILD_DECISION],
		name: "each ternary of a nested ternary",
	},
	{
		code: "const Mixed = () => <div>{ready && (other ? <X /> : null)}</div>;",
		findings: [CHILD_DECISION, CHILD_DECISION],
		name: "a && and the ternary inside it",
	},
	{ code: "const Leaked = () => <div>{count && label}</div>;", findings: [CHILD_DECISION], name: "a && that renders a value" },
	{
		code: "const Items = () => <ul>{items.map(item => item.visible ? <li /> : null)}</ul>;",
		findings: [MAPPED_DECISION],
		name: "a ternary a .map callback returns",
	},
	{
		code: "const Block = () => <ul>{items.map(item => { return item.visible && <li />; })}</ul>;",
		findings: [MAPPED_DECISION],
		name: "a && a .map block body returns",
	},
	{
		code: "const Child = () => <ul>{items.map(item => <li>{item.visible && <X />}</li>)}</ul>;",
		findings: [MAPPED_DECISION],
		name: "a && inside the child of a mapped item",
	},
];

export const jsxAccepted = [
	{
		code: "function Computed({ ready }) { const content = ready ? <X /> : <Y />; return <div>{content}</div>; }",
		name: "a variable computed above the return",
	},
	{
		code: 'const Styled = ({ ready }) => <div className={ready ? "active" : "idle"} title={ready && "ready"} />;',
		name: "conditional attribute values",
	},
	{ code: "const Wrapped = ({ ready }) => <Frame content={ready ? <X /> : null} />;", name: "a ternary passed as a prop" },
	{
		code: "const Spread = ({ items }) => <>{items.map(item => <X {...(item.ready ? activeProps : idleProps)} />)}</>;",
		name: "a ternary inside a spread attribute",
	},
];
