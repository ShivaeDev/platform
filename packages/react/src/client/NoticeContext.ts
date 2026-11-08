import { createContext, type ReactNode } from "react";
import type { noticeStore } from "#noticeStore.ts";

export const NoticeContext = createContext<ReturnType<typeof noticeStore<ReactNode>> | undefined>(undefined);
