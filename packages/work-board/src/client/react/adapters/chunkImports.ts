export const chunkImports = {
	goalChart: () => import("#client/react/GoalChart.tsx"),
	markdown: () => import("#client/react/markdownRenderers.ts").then(({ markdownRenderers }) => markdownRenderers),
	searchPalette: () => import("#client/react/SearchPalette.tsx"),
	workTable: () => import("#client/react/WorkTable.tsx"),
};
