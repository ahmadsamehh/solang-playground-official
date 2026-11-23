import { Suspense } from "react";
import type { Metadata } from "next";
import { AnalyticsDashboard } from "./components/dashboard";
import { AnalyticsTopBar } from "./components/analytics-top-bar";

export const metadata: Metadata = {
  title: "Solang Analytics",
  description: "Usage of the Solang Playground on Stellar testnet",
};

/** Shell only: all data loads client-side through /api/analytics so the range lives in the URL. */
export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsTopBar />}>
      <AnalyticsDashboard />
    </Suspense>
  );
}
