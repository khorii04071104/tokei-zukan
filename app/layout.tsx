import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "時計図鑑 | Watch Zukan",
  description: "個人コレクション・仕入れ管理ツール"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body className="antialiased bg-black text-zinc-200 font-sans">
        {children}
      </body>
    </html>
  );
}
