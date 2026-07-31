"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-slate-50">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong!</h2>
      <p className="text-slate-600 mb-6 max-w-md">
        An unexpected error occurred during rendering.
      </p>
      <div className="flex gap-4">
        <button onClick={() => reset()} className="btn-primary">
          Try again
        </button>
        <a href="/" className="btn-secondary">
          Go Back Home
        </a>
      </div>
    </div>
  );
}
