import type { Metadata } from "next";
import { Suspense } from "react";
import AuthScreen from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Sign up · InstaCaps" };

export default function SignupPage() {
  return (
    <Suspense>
      <AuthScreen mode="signup" />
    </Suspense>
  );
}
