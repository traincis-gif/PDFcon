import type { Metadata } from 'next';
import { UploadContent } from './upload-content';

export const metadata: Metadata = {
  title: 'Upload & Process',
};

export default function UploadPage() {
  return <UploadContent />;
}
