'use client';

import { notFound } from 'next/navigation';
import { MasterDataManager } from '../../../components/master-data-manager';
import { MasterBodySchemas, type MasterResource } from '@school/shared';

export default function ResourcePage({ params }: { params: { resource: string } }) {
  if (!(params.resource in MasterBodySchemas)) notFound();
  return <MasterDataManager resource={params.resource as MasterResource} />;
}
