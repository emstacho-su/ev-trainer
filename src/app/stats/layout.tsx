"use client";

/**
 * Overview: Stats dashboard layout with authentication guard.
 * Interacts with: localStorage access_token, login page redirect.
 * Importance: Ensures only authenticated users access performance data.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login?returnUrl=/stats");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-slate-200" />
      </div>
    );
  }

  return <>{children}</>;
}
