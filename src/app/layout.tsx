import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "ApparelFlow ERP · Cutting Gate",
  description: "Production batch verification and sewing queue gate",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <html lang="en">
      <body>
        <Header user={s ? { name: s.name, role: s.role } : null} />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
