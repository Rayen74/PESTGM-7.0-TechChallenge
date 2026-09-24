"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CitizenRequests() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/citizen');
  }, [router]);

  return null;
}

