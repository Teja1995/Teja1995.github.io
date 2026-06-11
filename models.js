// AI model registry for worksheet checking
// Accuracy rank: 5 = best, 1 = lowest
// Models are tried in accuracy order when auto-failover kicks in

const MODELS = [
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'Google AI Studio',
        tag: 'Recommended',
        tagClass: 'tag-recommended',
        accuracy: 5,
        rpmLabel: '5 req / min',
        keyStorageKey: 'geminiApiKey',
        dbKey: 'geminiKey',
        icon: `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>`,
        keyUrl: 'https://aistudio.google.com/app/apikey',
        keyPlaceholder: 'Paste your Google AI Studio key',
        keyNote: '⚠ Get the key from AI Studio — not Google Cloud Console. Cloud Console keys have 0 free quota.',
        keySteps: [
            { text: 'Go to ', link: { label: 'aistudio.google.com/app/apikey', url: 'https://aistudio.google.com/app/apikey' } },
            { text: 'Sign in with your Google account' },
            { text: 'Click "Create API key" → "Create API key in new project"' },
            { text: 'Copy the key and paste it below' }
        ],
        apiFormat: 'gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    },
    {
        id: 'llama-4-scout',
        name: 'Llama 4 Scout',
        provider: 'Groq',
        tag: 'Fastest',
        tagClass: 'tag-fast',
        accuracy: 3,
        rpmLabel: '30 req / min',
        keyStorageKey: 'groqApiKey',
        dbKey: 'groqKey',
        icon: `<svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
            <rect width="28" height="28" rx="6" fill="#F55036"/>
            <path d="M17 5l-9 11h6.5l-2.5 7 10-13H16L17 5z" fill="white"/>
        </svg>`,
        keyUrl: 'https://console.groq.com/keys',
        keyPlaceholder: 'Paste your Groq API key',
        keyNote: '✓ Groq is completely free with no credit card required. 30 req/min, 14,400 req/day.',
        keySteps: [
            { text: 'Go to ', link: { label: 'console.groq.com/keys', url: 'https://console.groq.com/keys' } },
            { text: 'Create a free account (no credit card needed)' },
            { text: 'Click "Create API Key", give it any name' },
            { text: 'Copy the key and paste it below' }
        ],
        apiFormat: 'openai',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        modelId: 'meta-llama/llama-4-scout-17b-16e-instruct'
    },
    {
        id: 'openrouter-gemini',
        name: 'Gemini 2.0 Flash',
        provider: 'OpenRouter',
        tag: 'No Cost',
        tagClass: 'tag-free',
        accuracy: 4,
        rpmLabel: 'Varies',
        keyStorageKey: 'openrouterApiKey',
        dbKey: 'openrouterKey',
        icon: `<svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
            <rect width="28" height="28" rx="6" fill="#6D28D9"/>
            <circle cx="7" cy="10" r="2.5" fill="white"/>
            <circle cx="7" cy="18" r="2.5" fill="white"/>
            <circle cx="21" cy="14" r="2.5" fill="white"/>
            <path d="M9.5 10.5L18.5 13.5M9.5 17.5L18.5 14.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`,
        keyUrl: 'https://openrouter.ai/settings/keys',
        keyPlaceholder: 'Paste your OpenRouter API key',
        keyNote: '✓ OpenRouter is free for select models. One key gives access to multiple AI models.',
        keySteps: [
            { text: 'Go to ', link: { label: 'openrouter.ai/settings/keys', url: 'https://openrouter.ai/settings/keys' } },
            { text: 'Create a free account' },
            { text: 'Click "Create Key" and copy it' },
            { text: 'Paste it below — free models need no credits' }
        ],
        apiFormat: 'openai',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'google/gemini-2.0-flash-exp:free'
    },
    {
        id: 'openrouter-qwen',
        name: 'Qwen 2.5 VL 72B',
        provider: 'OpenRouter',
        tag: 'Alternative',
        tagClass: 'tag-alt',
        accuracy: 3,
        rpmLabel: 'Varies',
        keyStorageKey: 'openrouterApiKey',
        dbKey: 'openrouterKey',
        icon: `<svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
            <rect width="28" height="28" rx="6" fill="#6D28D9"/>
            <circle cx="7" cy="10" r="2.5" fill="white"/>
            <circle cx="7" cy="18" r="2.5" fill="white"/>
            <circle cx="21" cy="14" r="2.5" fill="white"/>
            <path d="M9.5 10.5L18.5 13.5M9.5 17.5L18.5 14.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`,
        keyUrl: 'https://openrouter.ai/settings/keys',
        keyPlaceholder: 'Paste your OpenRouter API key',
        keyNote: '✓ Uses the same OpenRouter key as Gemini 2.0 Flash above. Qwen 2.5 VL is a strong vision model from Alibaba.',
        keySteps: [
            { text: 'Go to ', link: { label: 'openrouter.ai/settings/keys', url: 'https://openrouter.ai/settings/keys' } },
            { text: 'Create a free account' },
            { text: 'Click "Create Key" and copy it' },
            { text: 'Paste it below — free models need no credits' }
        ],
        apiFormat: 'openai',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'qwen/qwen2.5-vl-72b-instruct:free'
    }
];

// Returns models in failover order: selected model first, then rest by accuracy desc
function getFailoverOrder(selectedId) {
    const selected = MODELS.find(m => m.id === selectedId);
    const rest = MODELS
        .filter(m => m.id !== selectedId)
        .sort((a, b) => b.accuracy - a.accuracy);
    return selected ? [selected, ...rest] : rest;
}
