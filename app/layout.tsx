import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import StorageCleanup from "@/components/StorageCleanup";
import NetworkStatus from "@/components/NetworkStatus";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UK Financial Regulation 学習支援アプリ",
  description: "CISI UK Financial Regulation (ED31) 試験対策アプリケーション",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>
          <ErrorBoundary>
            <NetworkStatus />
            {children}
            <StorageCleanup />
          </ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}