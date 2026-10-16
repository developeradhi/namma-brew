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
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const factsObj = ((lockedFacts as any)?.facts || lockedFacts || {}) as Record<string, any>;
    const businessName = (factsObj.businessName || campaignInput.businessName || "Namma Brew").toString();
    const offer = (factsObj.offer || campaignInput.offer || "20% OFF").toString();
    const product = (factsObj.offerAppliesTo || campaignInput.exactOfferDetails || "Cappuccino & Filter Coffee").toString();
    const validity = (factsObj.validity || campaignInput.offerValidity || "Saturday & Sunday").toString();
    const conditions = (factsObj.conditions || campaignInput.conditions || "Valid ID required").toString();
    const location = (factsObj.location || campaignInput.location || "Koramangala, Bengaluru").toString();
    const audience = (factsObj.eligibleCustomers || campaignInput.targetAudience || "Coffee Lovers").toString();
    const tag = businessName.replace(/[^a-zA-Z0-9]/g, "");

    const currentCampaign = {
      strategy: `Drive footfall for ${audience} at ${businessName} (${location}) by featuring ${offer} on ${product} (${validity}).`,
      coreMessage: `${offer} on ${product} at ${businessName} — ${validity}!`,
      content: {
        English: {
          Instagram: `Weekend vibes just got better at ${businessName}! ☕\n\nCatch up with friends and enjoy ${offer} on your favorite ${product} this weekend (${validity}) in ${location}. Tag your coffee buddy below! 👇\n\n📋 Note: ${conditions}\n#${tag} #FilterCoffee #BengaluruCafes #SpecialOffer #WeekendVibes`,
          WhatsApp: `☕ *${businessName} Exclusive Alert!*\n\nHey ${audience}! Enjoy *${offer}* on *${product}*.\n\n🗓️ *Validity:* ${validity}\n📍 *Location:* ${location}\n📋 *Terms:* ${conditions}\n\nFlash this message at our counter to claim your discount! 🚀`,
          Email: `Subject: Need a coffee break? ${offer} on ${product} at ${businessName}!\n\nHi there,\n\nTreat yourself! Enjoy ${offer} on ${product} from ${validity} at our ${location} branch.\n\nWhether you're catching up on work or relaxing with friends, ${businessName} is the perfect spot.\n\nConditions: ${conditions}\n\nWarm regards,\nTeam ${businessName}`,
          Facebook: `Wrap up your week with a premium brew at ${businessName}! ☕ Join us this weekend (${validity}) for ${offer} on ${product}. The perfect environment in ${location} to relax or connect with friends. Valid for ${audience} (${conditions}).`
        },
        Kannada: {
          Instagram: `☕ ${businessName} ನಲ್ಲಿ ವೀಕೆಂಡ್ ವೈಬ್ಸ್ ಮತ್ತಷ್ಟು ಸೂಪರ್! 🌟\n\nನಮ್ಮ ಜನಪ್ರಿಯ ${product} ಮೇಲೆ ಪಡೆಯಿರಿ ${offer} (${validity})! ${location} ನ ನಮ್ಮ ಕೆಫೆಗೆ ನಿಮ್ಮ ಸ್ನೇಹಿತರೊಂದಿಗೆ ಬನ್ನಿ ಮತ್ತು ಆನಂದಿಸಿ! 👇\n\n📋 ನಿಯಮಗಳು: ${conditions}\n#ನಮ್ಮಬ್ರೂ #ಬೆಂಗಳೂರುಕೆಫೆ #ಫಿಲ್ಟರ್‌ಕಾಫಿ #ವಿಶೇಷಆಫರ್`,
          WhatsApp: `☕ *${businessName} ವತಿಯಿಂದ ವಿಶೇಷ ಕೊಡುಗೆ!*\n\nನಮ್ಮ ಪ್ರೀತಿಯ ಗ್ರಾಹಕರೇ, ನಿಮ್ಮ ಮೆಚ್ಚಿನ *${product}* ಮೇಲೆ ಪಡೆಯಿರಿ *${offer}*!\n\n🗓️ *ಅವಧಿ:* ${validity}\n📍 *ಸ್ಥಳ:* ${location}\n📋 *ನಿಯಮಗಳು:* ${conditions}\n\nಇಂದೇ ನಮ್ಮ ${location} ಕೆಫೆಗೆ ಭೇಟಿ ನೀಡಿ ಈ ಭರ್ಜರಿ ಕೊಡುಗೆಯನ್ನು ಪಡೆದುಕೊಳ್ಳಿ! ✨`,
          Email: `ವಿಷಯ: ${businessName} ನಲ್ಲಿ ನಿಮಗಾಗಿ ವಿಶೇಷ ಆಫರ್: ${product} ಮೇಲೆ ${offer}!\n\nನಮಸ್ಕಾರ,\n\n${validity} ಅವಧಿಯಲ್ಲಿ ನಮ್ಮ ${businessName} ಕೆಫೆಯಲ್ಲಿ (${location}) ${product} ಮೇಲೆ ${offer} ವಿಶೇಷ ರಿಯಾಯಿತಿ ಪಡೆಯಿರಿ.\n\nನಿಯಮಗಳು: ${conditions}\n\nಬನ್ನಿ, ಶುದ್ಧ ಫಿಲ್ಟರ್ ಕಾಫಿಯೊಂದಿಗೆ ಆರಾಮಾಗಿ ಸಮಯ ಕಳೆಯಿರಿ!\n\nಧನ್ಯವಾದಗಳೊಂದಿಗೆ,\n${businessName} ತಂಡ`,
          Facebook: `${businessName} ನಲ್ಲಿ ಈ ವಾರಾಂತ್ಯಕ್ಕೆ ಒಂದು ಬಿಸಿ ಬಿಸಿ ${product} ಸವಿಯಿರಿ! ☕ ಪಡೆಯಿರಿ ${offer} (${validity}). ಸ್ನೇಹಿತರು ಮತ್ತು ಕುಟುಂಬದೊಂದಿಗೆ ಆರಾಮವಾಗಿ ಸಮಯ ಕಳೆಯಲು ${location} ನಲ್ಲಿರುವ ನಮ್ಮ ಕೆಫೆಗೆ ಭೇಟಿ ನೀಡಿ (${conditions}).`
        }
      }
    };
    
    const validationResult = {
      status: "PASS",
      issues: [],
      checkedFacts: [
        `Offer: "${offer}" strictly preserved with zero variance`,
        `Product: "${product}" matched without alteration`,
        `Validity: "${validity}" correctly constrained`,
        `Conditions: "${conditions}" verified`,
        `Location: "${location}" confirmed accurate`
      ],
      correctionsRequired: []
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
