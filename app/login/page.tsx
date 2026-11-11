import type { Metadata } from "next";
import { Suspense } from "react";
import AuthScreen from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Log in · InstaCaps" };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthScreen mode="login" />
    </Suspense>
  );
}
