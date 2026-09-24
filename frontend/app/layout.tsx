import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Tunisie Solar Power Forecasting | STEG Grid Dispatch",
  description:
    "Plateforme de prévision solaire photovoltaïque multi-échelles et de dispatching pour le réseau tunisien (STEG).",
  icons: {
    icon: "https://upload.wikimedia.org/wikipedia/commons/c/ce/Flag_of_Tunisia.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className="antialiased selection:bg-amber-500/30 selection:text-amber-200">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
