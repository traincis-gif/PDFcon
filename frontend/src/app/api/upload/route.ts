import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:9090';

/** Maximum file size per file: 50MB */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

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

    // Validate file sizes BEFORE converting to base64 to fail fast
    for (const file of fileEntries) {
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return NextResponse.json(
          {
            error: {
              code: 'FILE_TOO_LARGE',
              message: `File "${file.name}" is ${sizeMB}MB which exceeds the 50MB limit`,
            },
          },
          { status: 413 }
        );
      }
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

    // Forward cookies from the browser request to the backend
    const cookieHeader = request.headers.get('cookie') || '';

    // Send to backend as JSON
    const response = await fetch(`${BACKEND_URL}/jobs/upload-and-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ files, operation, metadata }),
    });

    const data = await response.json();

    const nextResponse = NextResponse.json(data, {
      status: response.ok ? 201 : response.status,
    });

    // Forward Set-Cookie headers from backend response back to browser
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    for (const setCookie of setCookieHeaders) {
      nextResponse.headers.append('Set-Cookie', setCookie);
    }

    return nextResponse;
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: { code: 'UPLOAD_ERROR', message: error.message || 'Upload failed' } },
      { status: 500 }
    );
  }
}
