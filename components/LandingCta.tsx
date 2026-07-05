"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function LandingCta({ mockMode }: { mockMode: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    await signIn(mockMode ? "mock" : "spotify", { callbackUrl: "/frontier" });
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="group inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-black transition hover:bg-accent/90 disabled:opacity-60"
    >
      {loading ? "Connecting…" : mockMode ? "Continue in Demo Mode" : "Connect with Spotify"}
      <svg
        className="h-4 w-4 transition group-hover:translate-x-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
