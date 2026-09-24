"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";

/**
 * Root page — simply redirects:
 *  • Not logged in  → /login
 *  • ADMIN          → /admin
 *  • CITIZEN        → /citizen
 */
export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const sess = getSession();
    if (!sess) {
      router.replace("/login");
    } else if (sess.role === "ADMIN") {
      router.replace("/admin");
    } else {
      router.replace("/citizen");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16]">
      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
