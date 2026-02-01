const STORAGE_KEY = 'brand_tone_trainer_saved';
const API_KEY_STORAGE = 'brand_tone_trainer_api_key';

const elements = {
  brandInput: document.getElementById('brand-input'),
  apiKeyInput: document.getElementById('api-key'),
  btnGenerate: document.getElementById('btn-generate'),
  btnSave: document.getElementById('btn-save'),
  results: document.getElementById('results'),
  loading: document.getElementById('loading'),
  loadingText: document.getElementById('loading-text'),
  toneDesc: document.getElementById('tone-desc'),
  copyList: document.getElementById('copy-list'),
  vocabSuggest: document.getElementById('vocab-suggest'),
  vocabAvoid: document.getElementById('vocab-avoid'),
  saveStatus: document.getElementById('save-status'),
  savedBrands: document.getElementById('saved-brands'),
  savedBrandsList: document.getElementById('saved-brands-list'),
  errorMsg: document.getElementById('error-msg'),
};

let currentData = null;

// Google Gemini API Integration
const GEMINI_URL = 'https://api.yyds168.net/v1beta/models/gemini-3-pro-preview:generateContent';

function getApiKey() {
  const fromInput = elements.apiKeyInput?.value?.trim();
  if (fromInput) return fromInput;
  try {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

function persistApiKey(key) {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key);
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch (_) {}
}

function buildPrompt(brand) {
  const name = brand || 'My Brand';
  return `You are a brand copywriter analyzing the brand "${name}".

Generate a brand tone guide with this EXACT format:

TONE DESCRIPTION:
[Write 2-3 sentences describing the brand's tone and voice]

COPY EXAMPLES (10 sets, each with 3 tones):

Copy 1:
Professional: [1-2 sentences]
Cute: [1-2 sentences]
Bold: [1-2 sentences]

Copy 2:
Professional: [1-2 sentences]
Cute: [1-2 sentences]
Bold: [1-2 sentences]

Copy 3:
Professional: [1-2 sentences]
Cute: [1-2 sentences]
Bold: [1-2 sentences]

Copy 4:
Professional: [1-2 sentences]
Cute: [1-2 sentences]
Bold: [1-2 sentences]

Copy 5:
Professional: [1-2 sentences]
Cute: [1-2 sentences]
Bold: [1-2 sentences]

Copy 6:
Professional: [1-2 sentences]
Cute: [1-2 sentences]
Bold: [1-2 sentences]

Copy 7:
Professional: [1-2 sentences]
Cute: [1-2 sentences]
Bold: [1-2 sentences]

Copy 8:
Professional: [1-2 sentences]
Cute: [1-2 sentences]
Bold: [1-2 sentences]

Copy 9:
Professional: [1-2 sentences]
Cute: [1-2 sentences]
Bold: [1-2 sentences]

Copy 10:
Professional: [1-2 sentences]
Cute: [1-2 sentences]
Bold: [1-2 sentences]

SUGGESTED VOCABULARY:
[List 10-12 words separated by commas]

AVOID VOCABULARY:
[List 10-12 words separated by commas]

Follow this format exactly. All content in English.`;
}

function parseTextResponse(text) {
  console.log('📝 Parsing text response...');
  
  try {
    // Extract tone description
    const toneMatch = text.match(/TONE DESCRIPTION:\s*\n([\s\S]*?)(?=\n\nCOPY EXAMPLES|COPY EXAMPLES)/i);
    const toneDescription = toneMatch ? toneMatch[1].trim() : '';
    
    // Extract all copy blocks
    const copies = [];
    const copyRegex = /Copy (\d+):\s*\n\s*Professional:\s*(.*?)\s*\n\s*Cute:\s*(.*?)\s*\n\s*Bold:\s*(.*?)(?=\n\nCopy \d+:|SUGGESTED VOCABULARY|$)/gis;
    
    let match;
    while ((match = copyRegex.exec(text)) !== null && copies.length < 10) {
      copies.push({
        index: copies.length + 1,
        professional: match[2].trim(),
        cute: match[3].trim(),
        aggressive: match[4].trim()
      });
    }
    
    // If we didn't get 10 copies, fill with templates
    while (copies.length < 10) {
      copies.push({
        index: copies.length + 1,
        professional: 'Quality content for your brand.',
        cute: 'Something fun and engaging~',
        aggressive: 'Bold statement. Direct action.'
      });
    }
    
    // Extract vocabulary
    const suggestMatch = text.match(/SUGGESTED VOCABULARY:\s*\n(.*?)(?=\n\nAVOID VOCABULARY|AVOID VOCABULARY|$)/is);
    const avoidMatch = text.match(/AVOID VOCABULARY:\s*\n(.*?)$/is);
    
    const vocabSuggest = suggestMatch 
      ? suggestMatch[1].trim().split(/,\s*/).filter(w => w).slice(0, 12)
      : ['quality', 'reliable', 'trusted', 'innovative', 'excellent', 'professional', 'authentic', 'premium', 'effective', 'proven'];
    
    const vocabAvoid = avoidMatch 
      ? avoidMatch[1].trim().split(/,\s*/).filter(w => w).slice(0, 12)
      : ['cheap', 'fake', 'guaranteed', 'viral', 'best ever', 'perfect', 'ultimate', 'revolutionary', 'miracle', 'instant'];
    
    console.log('✅ Text parsing successful');
    console.log('📊 Extracted:', {
      toneDescLength: toneDescription.length,
      copiesCount: copies.length,
      vocabSuggestCount: vocabSuggest.length,
      vocabAvoidCount: vocabAvoid.length
    });
    
    return {
      toneDescription,
      copies,
      vocabSuggest,
      vocabAvoid
    };
  } catch (error) {
    console.error('❌ Text parsing error:', error);
    throw error;
  }
}

async function generateWithApi(brand) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('⚠️ No API key found');
    return null;
  }

  const name = (brand || '').trim() || 'My Brand';
  console.log('🚀 Calling Google Gemini API for brand:', name);
  
  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: buildPrompt(name)
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048
        }
      }),
    });

    console.log('📡 API Response Status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      
      console.error('❌ API Error Response:', errorMessage);
      
      if (response.status === 429) {
        throw new Error(`RATE_LIMIT: Rate limit exceeded.`);
      } else if (response.status === 400) {
        throw new Error('INVALID_REQUEST: Invalid API key or request format.');
      } else if (response.status === 403) {
        throw new Error('FORBIDDEN: Your API key does not have access.');
      } else if (response.status === 500) {
        throw new Error('SERVER_ERROR: Gemini server error.');
      } else {
        throw new Error(`API_ERROR: ${errorMessage}`);
      }
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error('❌ Empty API response');
      throw new Error('Empty API response');
    }

    console.log('✅ Received AI response');
    console.log('📝 Content length:', content.length);
    
    const parsed = parseTextResponse(content);
    
    return {
      brand: name,
      toneDescription: parsed.toneDescription,
      copies: parsed.copies,
      vocabSuggest: parsed.vocabSuggest,
      vocabAvoid: parsed.vocabAvoid,
    };
  } catch (error) {
    console.error('❌ API call failed:', error.message);
    throw error;
  }
}

// Fallback: Template-based Generation
function getToneDescription(brand) {
  const templates = [
    `${brand}'s tone is concise and memorable, using short sentences and a few key words to convey attitude.`,
    `${brand} emphasizes authenticity and approachability, with a conversational style that feels close to the audience.`,
    `${brand} focuses on rhythm and repetition, making copy easy to remember at a glance.`,
  ];
  return templates[hashCode(brand) % templates.length];
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return Math.abs(h);
}

const copyTemplates = [
  { pro: 'Our new release is live. Quality and experience are rigorously vetted—worth trying first.', cute: 'New drop is here~ Super easy to use, give it a try!', aggressive: 'It\'s out. Try it or don\'t—your call.' },
  { pro: 'Limited-time offer in progress. We recommend completing your order during the promotion for the best price.', cute: 'Limited offer~ Miss it and you\'ll wait forever. Go for it!', aggressive: 'Limited time. No second chances.' },
  { pro: 'Materials and craftsmanship meet clear standards. You can choose with confidence.', cute: 'Really reliable—picking us is never wrong~', aggressive: 'Quality speaks. Don\'t like it? Don\'t buy.' },
  { pro: 'We respond to every choice you make with professional service and after-sales support.', cute: 'You choose us, we\'ve got you~', aggressive: 'You chose. We deliver. No regrets.' },
  { pro: 'Design prioritizes ease of use so you can complete the main task in one step.', cute: 'So simple—you\'ll get it in one go!', aggressive: 'Simple. One step. Done.' },
  { pro: 'Real user feedback shows high satisfaction and repeat purchase rates.', cute: 'Everyone who tried it loves it~ You should too!', aggressive: 'Real users say it. Check the reviews.' },
  { pro: 'Orders placed today qualify for next-day delivery with reliable logistics.', cute: 'Order today, get it tomorrow~ No long wait!', aggressive: 'Order today. Get it tomorrow. That\'s it.' },
  { pro: 'We recommend choosing based on your needs—what fits you is what works best.', cute: 'What fits you is best~ We\'re the right pick!', aggressive: 'You know what fits. Choose right.' },
  { pro: 'Thank you for your trust. We will keep improving our products and service.', cute: 'Thanks for the love~ We\'ll keep doing our best!', aggressive: 'Thanks. We\'ll do better. Watch.' },
  { pro: 'We work with you to explore better solutions and experiences.', cute: 'Let\'s discover more good things together~', aggressive: 'Better is here. Keep up.' },
];

function generateCopyVariants(brand, index) {
  const t = copyTemplates[index % copyTemplates.length];
  const name = brand ? `${brand} · ` : '';
  return {
    professional: name + t.pro,
    cute: name + t.cute,
    aggressive: name + t.aggressive,
  };
}

const suggestPool = [
  ['quality', 'reliable', 'simple', 'real', 'trust', 'worth', 'curated', 'pro', 'care', 'solid'],
  ['easy', 'effortless', 'efficient', 'clear', 'direct', 'sincere', 'accountable', 'transparent', 'steady', 'safe'],
  ['experience', 'detail', 'standard', 'support', 'service', 'quality', 'real', 'simple', 'efficient', 'trust'],
];

const avoidPool = [
  ['best', 'first', 'absolute', '100%', 'ever', 'everywhere', 'must-buy', 'hype', 'steal', 'gimmick'],
  ['ultimate', 'perfect', 'unbeatable', 'viral', 'limited', 'last chance', 'don\'t miss', 'regret', 'cheap', 'trick'],
  ['exaggerated', 'fake', 'overstated', 'guaranteed', 'always', 'never', 'strongest', 'cheapest'],
];

function getVocab(brand) {
  const h = hashCode(brand || 'brand');
  return {
    suggest: [...new Set(suggestPool[h % 3].concat(suggestPool[(h + 1) % 3]).slice(0, 10))],
    avoid: [...new Set(avoidPool[h % 3].concat(avoidPool[(h + 1) % 3]).slice(0, 10))],
  };
}

function generateFallback(brand) {
  const name = (brand || '').trim() || 'My Brand';
  const toneDesc = getToneDescription(name);
  const copies = Array.from({ length: 10 }, (_, i) => ({
    index: i + 1,
    ...generateCopyVariants(name, i),
  }));
  const vocab = getVocab(name);
  return {
    brand: name,
    toneDescription: toneDesc,
    copies,
    vocabSuggest: vocab.suggest,
    vocabAvoid: vocab.avoid,
  };
}

function render(data) {
  currentData = data;
  elements.toneDesc.textContent = data.toneDescription;

  elements.copyList.innerHTML = data.copies
    .map(
      (c) => `
    <div class="copy-item" data-index="${c.index}">
      <div class="copy-label">Copy #${c.index}</div>
      <div class="copy-versions">
        <div class="copy-version">
          <span class="tag tag-professional">Professional</span>
          <span class="copy-text">${escapeHtml(c.professional)}</span>
        </div>
        <div class="copy-version">
          <span class="tag tag-cute">Cute</span>
          <span class="copy-text">${escapeHtml(c.cute)}</span>
        </div>
        <div class="copy-version">
          <span class="tag tag-aggressive">Bold</span>
          <span class="copy-text">${escapeHtml(c.aggressive)}</span>
        </div>
      </div>
    </div>
  `
    )
    .join('');

  elements.vocabSuggest.innerHTML = (data.vocabSuggest || []).map((w) => `<li>${escapeHtml(w)}</li>`).join('');
  elements.vocabAvoid.innerHTML = (data.vocabAvoid || []).map((w) => `<li>${escapeHtml(w)}</li>`).join('');

  elements.results.classList.add('active');
  elements.saveStatus.textContent = '';
  elements.saveStatus.classList.remove('success');
  hideError();
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function setLoading(show, text = 'Generating tone & copy...') {
  if (show) {
    elements.loading.classList.add('active');
    elements.results.classList.remove('active');
    if (elements.loadingText) elements.loadingText.textContent = text;
  } else {
    elements.loading.classList.remove('active');
  }
}

function showError(message) {
  if (elements.errorMsg) {
    elements.errorMsg.textContent = message;
    elements.errorMsg.classList.add('active');
  }
}

function hideError() {
  if (elements.errorMsg) {
    elements.errorMsg.classList.remove('active');
  }
}

function getSavedBrands() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveToStorage() {
  if (!currentData) return;
  try {
    const saved = getSavedBrands();
    saved[currentData.brand] = {
      ...currentData,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    elements.saveStatus.textContent = '✓ Saved to localStorage';
    elements.saveStatus.classList.add('success');
    renderSavedBrands();
  } catch (e) {
    elements.saveStatus.textContent = '✗ Save failed: ' + (e.message || 'Unknown error');
  }
}

function loadSavedBrand(brandName) {
  const saved = getSavedBrands();
  const data = saved[brandName];
  if (!data) return;
  elements.brandInput.value = brandName;
  currentData = data;
  render(data);
}

function deleteSavedBrand(brandName) {
  try {
    const saved = getSavedBrands();
    delete saved[brandName];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    renderSavedBrands();
    
    if (currentData?.brand === brandName) {
      elements.results.classList.remove('active');
      currentData = null;
    }
  } catch (e) {
    console.error('Delete failed:', e);
  }
}

function renderSavedBrands() {
  const saved = getSavedBrands();
  const names = Object.keys(saved);
  if (names.length === 0) {
    elements.savedBrands.classList.remove('active');
    return;
  }
  elements.savedBrands.classList.add('active');
  elements.savedBrandsList.innerHTML = names
    .map(
      (name) =>
        `<div class="saved-item">
          <button type="button" class="load-brand" data-brand="${escapeHtml(name)}">${escapeHtml(name)}</button>
          <button type="button" class="delete-btn" data-brand="${escapeHtml(name)}">×</button>
        </div>`
    )
    .join('');
  elements.savedBrandsList.querySelectorAll('.load-brand').forEach((btn) => {
    btn.addEventListener('click', () => loadSavedBrand(btn.dataset.brand));
  });
  elements.savedBrandsList.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm(`Delete "${btn.dataset.brand}"?`)) {
        deleteSavedBrand(btn.dataset.brand);
      }
    });
  });
}

// Generate: try API first, then fallback
elements.btnGenerate.addEventListener('click', async () => {
  const brand = elements.brandInput.value.trim();
  if (!brand) {
    showError('Please enter a brand name');
    return;
  }

  const apiKey = getApiKey();
  
  if (apiKey) {
    setLoading(true, '🤖 Generating with AI (Google Gemini)...');
    console.log('Using Google Gemini API');
  } else {
    setLoading(true, '📋 No API key found — using template mode...');
    console.log('No API key provided, using template generation');
  }

  try {
    const data = await generateWithApi(brand);
    if (data) {
      console.log('✅ AI generation successful!');
      render(data);
    } else {
      setLoading(true, '📋 Using template generation...');
      console.log('Using fallback templates');
      await new Promise((r) => setTimeout(r, 400));
      render(generateFallback(brand));
    }
  } catch (e) {
    console.error('❌ API Error:', e.message);
    showError(`⚠️ ${e.message}. Using template mode instead.`);
    setLoading(true, '📋 Switching to template mode...');
    await new Promise((r) => setTimeout(r, 800));
    render(generateFallback(brand));
  } finally {
    setLoading(false);
  }
});

elements.btnSave.addEventListener('click', saveToStorage);

elements.brandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') elements.btnGenerate.click();
});

// Persist API key when user types (debounced)
let apiKeyDebounce;
if (elements.apiKeyInput) {
  elements.apiKeyInput.addEventListener('input', () => {
    clearTimeout(apiKeyDebounce);
    apiKeyDebounce = setTimeout(() => persistApiKey(elements.apiKeyInput.value.trim()), 500);
  });
}

// Restore API key from localStorage on load
(function () {
  try {
    const stored = localStorage.getItem(API_KEY_STORAGE);
    if (stored && elements.apiKeyInput) elements.apiKeyInput.value = stored;
  } catch (_) {}
  renderSavedBrands();
})();