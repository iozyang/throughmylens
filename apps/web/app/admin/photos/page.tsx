import type { Metadata } from "next";
import AlbumManager from "../album-manager";

export const metadata: Metadata = { title: "管理我的照片", robots: { index: false, follow: false } };
export default function PhotosPage() { return <AlbumManager />; }
