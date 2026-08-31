import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "AI Agent OS",
  description: "Local AI Agent Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#050816] text-white">
        <div className="flex min-h-screen overflow-hidden bg-[#050816]">
          <Sidebar />

          <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
            <Header />

            <main className="flex-1 overflow-y-auto bg-[#050816] pt-24">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

