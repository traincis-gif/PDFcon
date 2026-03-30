import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:9090';

  try {
    const formData = await request.formData();

    // Forward the entire FormData to the backend
    const response = await fetch(`${backendUrl}/jobs/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Upload proxy error:', error);
    return NextResponse.json(
      { error: { code: 'PROXY_ERROR', message: error.message || 'Upload failed' } },
      { status: 502 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
