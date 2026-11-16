import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CYBERX OS — Digital Control Center",
  description: "One dashboard for your bots, APIs, cloud, projects and developer tools."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}