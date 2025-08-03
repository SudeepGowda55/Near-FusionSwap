import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🌐 API Route: Received polygon-to-near request');
    
    // Parse the request body
    const body = await request.json();
    console.log('📦 API Route: Request payload:', {
      ...body,
      makerPk: '***REDACTED***' // Don't log private key
    });

    // Forward the request to the backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/polygon-to-near/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Route: Backend error:', errorText);
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ API Route: Backend response received');
    console.log('📊 API Route: Response data:', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ API Route: Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Proxy error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
