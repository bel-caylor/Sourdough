const RECIPE_TEMPLATE = `{
  "name": "recipe name",
  "style": "bread style",
  "description": "1-2 sentence description",
  "loaves": 1,
  "ingredients": [
    { "name": "ingredient name", "amount": 450, "unit": "g" }
  ],
  "stages": [
    { "name": "stage name", "description": "detailed step-by-step instructions", "duration": "4-6 hours" }
  ],
  "starterAmount": 20,
  "notes": "baker tips and variations"
}`;

function buildPrompt({ style, ingredients, suggestions }) {
  return `Create a sourdough recipe with these details:

Style/Type: ${style || 'classic sourdough boule'}
${ingredients ? `Key ingredients or inclusions: ${ingredients}` : ''}
${suggestions ? `Baker's notes / preferences: ${suggestions}` : ''}

Return ONLY valid JSON (no markdown, no explanation) matching this structure exactly:
${RECIPE_TEMPLATE}

Requirements:
- Include all ingredients (flour(s), water, salt, active starter/levain)
- List stages in chronological order: Levain Build, Autolyse, Mix, Bulk Fermentation, Shape, Cold Proof, Bake, Cool
- starterAmount is the grams of active starter used to build the levain
- Amounts in grams (g) for solids/liquids, teaspoons for small amounts
- Make instructions detailed and practical`;
}

function extractJSON(text) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('AI returned invalid JSON. Please try again.');
  }
}

export async function generateRecipe({ style, ingredients, suggestions, apiKey, provider = 'anthropic' }) {
  if (!apiKey?.trim()) {
    throw new Error('No API key provided. Enter your API key in the recipe generator.');
  }

  const prompt = buildPrompt({ style, ingredients, suggestions });

  if (provider === 'openai') {
    return generateWithOpenAI(prompt, apiKey.trim());
  }
  return generateWithAnthropic(prompt, apiKey.trim());
}

async function generateWithAnthropic(prompt, apiKey) {
  const response = await fetch('/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      system: 'You are an expert sourdough baker. Respond with ONLY valid JSON — no markdown, no explanation.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error ${response.status}`);
  }

  const data = await response.json();
  return extractJSON(data.content?.[0]?.text || '');
}

async function generateWithOpenAI(prompt, apiKey) {
  const response = await fetch('/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an expert sourdough baker. Respond with ONLY valid JSON — no markdown, no explanation.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${response.status}`);
  }

  const data = await response.json();
  return extractJSON(data.choices?.[0]?.message?.content || '');
}
