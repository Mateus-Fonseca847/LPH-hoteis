import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";

import { AdminAccessDenied } from "./AdminAccessDenied";

type AdminLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  try {
    await requireAdminRouteSession();
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return (
        <div className="page-shell">
          <Header />
          <main className="admin-page">
            <AdminAccessDenied />
          </main>
          <Footer />
        </div>
      );
    }

    throw error;
  }

  return (
    <div className="page-shell">
      <Header />
      <main className="admin-page">{children}</main>
      <Footer />
    </div>
  );
}
