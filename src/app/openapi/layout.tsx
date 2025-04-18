import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpenAPI 查看器",
  description: "一个简单的 OpenAPI 文档查看工具",
};

export default function OpenAPILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
} 
