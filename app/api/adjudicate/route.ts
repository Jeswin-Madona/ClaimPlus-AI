import { NextRequest, NextResponse } from 'next/server';

const N8N_PROD_WEBHOOK = 'http://localhost:5678/webhook/claim-upload';
const N8N_TEST_WEBHOOK = 'http://localhost:5678/webhook-test/claim-upload';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let response: Response | null = null;
    let usedEndpoint = N8N_PROD_WEBHOOK;

    // Try test webhook first (so live canvas animation works when user clicks "Listen for test event" in n8n UI)
    try {
      usedEndpoint = N8N_TEST_WEBHOOK;
      response = await fetch(N8N_TEST_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (testErr) {
      console.warn('Test webhook endpoint unavailable, attempting production fallback...', testErr);
    }

    // Fallback to production webhook if test webhook failed or returned 404 (not currently listening in UI)
    if (!response || !response.ok) {
      if (!response || response.status === 404) {
        try {
          usedEndpoint = N8N_PROD_WEBHOOK;
          response = await fetch(N8N_PROD_WEBHOOK, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
        } catch (prodErr) {
          console.error('Production webhook also unavailable:', prodErr);
        }
      }
    }

    if (!response || !response.ok) {
      const errorStatus = response ? response.status : 503;
      const errorText = response ? await response.text() : 'n8n instance not reachable';
      return NextResponse.json(
        {
          error: 'Failed to communicate with n8n Adjudication Engine',
          status: errorStatus,
          details: errorText,
          attemptedEndpoints: [N8N_PROD_WEBHOOK, N8N_TEST_WEBHOOK],
        },
        { status: errorStatus === 404 ? 502 : errorStatus }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      ...data,
      _meta: {
        usedEndpoint,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('API Error in /api/adjudicate:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message },
      { status: 500 }
    );
  }
}
