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
	{ code: 'function Label({ on }) { return <span>{on ? "On" : label}</span>; }', findings: [CHILD_DECISION], name: "a computed label branch" },
	{ code: "const Amount = () => <span>{on ? 1 : read()}</span>;", findings: [CHILD_DECISION], name: "a computed number branch" },
	{ code: "const View = memo(() => <div>{ready && <X />}</div>);", findings: [CHILD_DECISION], name: "a memo component child" },
	{ code: "const View = React.forwardRef(() => <div>{ready && <X />}</div>);", findings: [CHILD_DECISION], name: "a forwardRef component child" },
	{ code: "export default () => <div>{ready && <X />}</div>;", findings: [CHILD_DECISION], name: "a default exported component child" },
	{
		code: "class View extends React.Component { render() { return <div>{ready && <X />}</div>; } }",
		findings: [CHILD_DECISION],
		name: "a class render child",
	},
	{
		code: "function View() { if (ready) { return <div>{visible && <X />}</div>; } return null; }",
		findings: [CHILD_DECISION],
		name: "a child in an early return",
	},
	{
		code: 'const List = ({ items }) => <>{items.map((item, index) => <span>{index > 0 && ", "}{item.name}</span>)}</>;',
		findings: [MAPPED_DECISION],
		name: "a separator decision inside returned JSX",
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
	{
		code: "function Computed({ ready }) { const content = <div>{ready && <X />}</div>; return <main>{content}</main>; }",
		name: "a JSX child decision built in a const above the return",
	},
	{
		code: "const content = <div>{ready ? <X /> : <Y />}</div>;",
		name: "JSX built outside a component",
	},
	{
		code: "function Chart() { const options = { formatter: value => <span>{value && <X />}</span> }; return <Library options={options} />; }",
		name: "a library formatter in options above the return",
	},
	{
		code: "const Chart = () => <Library formatter={value => { return <span>{value ? <X /> : <Y />}</span>; }} />;",
		name: "a library formatter passed as an attribute",
	},
	{
		code: "const Chart = () => <>{library(values, value => <span>{value && <X />}</span>)}</>;",
		name: "a callback passed to a library function inside returned JSX",
	},
	{
		code: 'function List({ items }) { return <>{items.map((item, index) => { const separator = index > 0 && ", "; return <span key={item.id}>{separator}{item.name}</span>; })}</>; }',
		name: "a list separator decided in a const before the item return",
	},
	{
		code: "function Item({ item }) { if (!item.visible) return null; return <li>{item.name}</li>; } const List = ({ items }) => <ul>{items.map(item => <Item key={item.id} item={item} />)}</ul>;",
		name: "an extracted item component returning null",
	},
	{ code: 'const Label = ({ on }) => <span>{on ? "On" : "Off"}</span>;', name: "plain string literal branches" },
	{ code: "const Amount = ({ on }) => <span>{on ? 1 : 0}</span>;", name: "plain number literal branches" },
	{ code: 'const Label = ({ on }) => <span>{on ? "On" : 0}</span>;', name: "mixed string and number literal branches" },
	{ code: 'const Label = ({ on }) => <span>{on ? ("On") : ("Off")}</span>;', name: "parenthesized literal branches" },
	{ code: "const Amount = ({ on }) => <span>{on ? -1 : +1}</span>;", name: "signed number literal branches" },
];
