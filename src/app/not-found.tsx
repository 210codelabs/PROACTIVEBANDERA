import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-slate-50">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Page Not Found</h2>
      <p className="text-slate-600 mb-6 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="btn-primary">
        Go Back Home
      </Link>
    </div>
  );
}
