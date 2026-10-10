import { NextResponse } from 'next/server';

// Sanitize string inputs to prevent injection
function sanitizeString(input: unknown, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength).replace(/<[^>]*>/g, '');
}

function sanitizeArray(arr: unknown, maxItems = 10): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === 'string')
    .slice(0, maxItems)
    .map(s => sanitizeString(s, 100));
}

export async function POST(req: Request) {
  // Enforce JSON content-type
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 415 });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const rawBody = body as Record<string, unknown>;
    const { campaignInput: rawInput, lockedFacts } = rawBody;

    // Sanitize and validate campaign input
    const campaignInput = rawInput && typeof rawInput === 'object' ? rawInput as Record<string, unknown> : null;
    if (!campaignInput || !lockedFacts) {
      return NextResponse.json({ error: 'Missing campaign input or facts.' }, { status: 400 });
    }
    // Sanitize text fields
    if (campaignInput.targetAudience) campaignInput.targetAudience = sanitizeString(campaignInput.targetAudience);
    if (campaignInput.brandTone) campaignInput.brandTone = sanitizeString(campaignInput.brandTone);
    if (campaignInput.offer) campaignInput.offer = sanitizeString(campaignInput.offer);
    if (Array.isArray(campaignInput.languages)) campaignInput.languages = sanitizeArray(campaignInput.languages);
    if (Array.isArray(campaignInput.channels)) campaignInput.channels = sanitizeArray(campaignInput.channels);

    // 2. Validation - Check that offer facts are locked
    const facts = lockedFacts as Record<string,unknown>;
    if (!facts || typeof facts !== 'object' || (facts.isLocked !== true && facts.status !== 'locked')) {
      return NextResponse.json({ error: 'Offer facts must be locked before generating a campaign.' }, { status: 400 });
    }
    
    // 3. Validation - Check clarifications server-side
    const questions = analyzeCampaignForClarifications(campaignInput);
    if (questions.length > 0) {
      return NextResponse.json({ 
        error: 'Unresolved clarifications remain.', 
        clarifications: questions 
      }, { status: 400 });
    }

    // MOCK AGNES AI RESPONSE (Bypassing API key requirement for demo)
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    let currentCampaign = {
      "strategy": "Drive weekend traffic by offering a flat 20% discount on select items.",
      "coreMessage": "20% OFF your favorite coffee this weekend!",
      "content": {
        "English": {
          "Instagram": "Weekend vibes just got better! ☕ Catch up with friends and enjoy 20% OFF your favorite coffee this weekend (Oct 10-12). Tag your coffee buddy below! 👇 #NammaBrew",
          "WhatsApp": "☕ Weekend Coffee Blast!\nGet 20% OFF on your favourite coffee from 10–12 October. Bring your friends and enjoy your weekend!"
        }
      }
    };
    
    let validationResult = {
      "status": "PASS",
      "issues": [],
      "checkedFacts": ["20% OFF offer", "Dates: Oct 10-12", "Tone matches brand guidelines"],
      "correctionsRequired": []
    };

    return NextResponse.json({
      success: true,
      campaign: currentCampaign,
      validation: validationResult
    });

  } catch {
    // Never expose internal error details to the client
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}

// Server-side copy of the deterministic rule engine to ensure security and consistency
function analyzeCampaignForClarifications(data: any) {
  const questions = [];
  const offerLower = (data.offer || "").toLowerCase();
  const promotingLower = (data.promoting || "").toLowerCase();
  
  if ((offerLower.includes("discount") || offerLower.includes("off")) && !/\d/.test(offerLower)) {
    questions.push({ id: "missing_discount", field: "offer" });
  }
  
  if (offerLower.includes("special offer") && offerLower.length < 20) {
    questions.push({ id: "vague_offer", field: "offer" });
  }

  if ((offerLower.includes("limited time") || promotingLower.includes("limited time")) && !offerLower.includes("date") && !offerLower.includes("until") && !/\d/.test(offerLower)) {
    questions.push({ id: "missing_dates", field: "offer" });
  }

  if ((data.targetAudience || "").toLowerCase().trim() === "everyone" || (data.targetAudience || "").toLowerCase().trim() === "anyone") {
    questions.push({ id: "vague_audience", field: "targetAudience" });
  }

  return questions;
}
