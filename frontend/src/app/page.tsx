'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Landing and home page: always show Roadmap. Redirect / to /roadmap (auth is enforced on Roadmap page). */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/roadmap');
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-[40vh]">
      <p className="text-gray-500">Redirecting to roadmap...</p>
    </div>
  );
}
