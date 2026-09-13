import type { Metadata } from "next";
import Library from "./library";

export const metadata: Metadata = { title: "照片管理", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <Library />;
}
