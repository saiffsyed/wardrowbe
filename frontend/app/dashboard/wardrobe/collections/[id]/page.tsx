'use client';

import { useParams } from 'next/navigation';
import { CollectionScreen } from '@/components/wardrobe/collection-screen';

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  return <CollectionScreen collectionId={id} />;
}
