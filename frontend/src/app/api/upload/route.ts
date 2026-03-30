import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:9090';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const operation = formData.get('operation') as string;
    const metadataStr = formData.get('metadata') as string;
    const fileEntries = formData.getAll('files') as File[];

    if (!operation) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'operation is required' } },
        { status: 400 }
      );
    }

    if (fileEntries.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'At least one file is required' } },
        { status: 400 }
      );
    }

    // Convert files to base64 for JSON transport to backend
    const files = await Promise.all(
      fileEntries.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return {
          name: file.name,
          data: base64,
          mimetype: file.type || 'application/pdf',
        };
      })
    );

    let metadata = {};
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        // ignore invalid metadata
      }
    }

    // Send to backend as JSON
    const response = await fetch(`${BACKEND_URL}/jobs/upload-and-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, operation, metadata }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: { code: 'UPLOAD_ERROR', message: error.message || 'Upload failed' } },
      { status: 500 }
    );
  }
}
