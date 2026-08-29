import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "群面实验室 · GroupLab",
  description: "与三名 AI 候选人完成无领导小组讨论，并获得基于团队状态变化的影响力报告。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
