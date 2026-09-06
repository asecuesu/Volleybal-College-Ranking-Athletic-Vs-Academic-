import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://asecuesu.github.io',
  'http://localhost:5173',
  'http://localhost:8000'
]);
const RESEARCH_WORKER = 'https://divine-dust-7329.andrei-secuesu.workers.dev';
const SETTER_TTL_DAYS = 120;
const AID_TTL_DAYS = 270;

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://asecuesu.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}
function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}
function extractJson(text: string) {
  const clean = String(text || '').replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
  const matches = clean.match(/\{[\s\S]*\}/g);
  if (!matches) return null;
  const longest = matches.reduce((a, b) => a.length >= b.length ? a : b);
  try { return JSON.parse(longest); } catch { return null; }
}
async function callResearchWorker(prompt: string) {
  const res = await fetch(RESEARCH_WORKER, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error(`research worker returned ${res.status}`);
  const raw = await res.json();
  const parts = raw?.candidates?.[0]?.content?.parts || [];
  const parsed = extractJson(parts.map((p: any) => p.text || '').join(' '));
  if (!parsed) throw new Error('research worker returned no usable JSON');
  return parsed;
}
function setterPrompt(schoolName: string) {
  return `Research the CURRENT or MOST RECENT OFFICIAL women's volleyball roster for ${schoolName}.
Use ONLY the university's official athletics website as the roster source. Do not use recruiting sites, Wikipedia, social media, or third-party roster databases.
Identify every player whose listed position includes Setter, S, S/RS, S/OPP, or an equivalent setter designation. Extract the player's full name, class/year, exact listed position, and exact listed height.
If a 2026/current roster is unavailable, use the most recent official roster you can find and state the season/year clearly. Do not infer a player's height and do not estimate a missing height.
Return ONLY valid JSON in exactly this shape:
{"pageUrl":"https://official-roster-url","season":"2026 or latest year","setters":[{"name":"","classYear":"","position":"","height":"5'7\\\"","heightInches":67}],"minHeightInches":67,"maxHeightInches":70,"summary":"Concise factual explanation of what this roster evidence implies for a 1.71 m / 5'7¼ setter."}
If no setter can be identified on the official roster, return an empty setters array, null minHeightInches/maxHeightInches, and explain that limitation in summary. Never invent data.`;
}
function aidPrompt(schoolName: string) {
  return `Research undergraduate financial aid for INTERNATIONAL applicants at ${schoolName} using ONLY official university admissions and financial-aid webpages.
Determine: (1) whether international applicants can receive institutional need-based aid; (2) whether admissions is need-blind or need-aware for international applicants; (3) whether the university says it meets 100% of demonstrated financial need for admitted international students; (4) whether merit scholarships are available to international applicants; and (5) any important limitation that materially affects an international applicant seeking substantial aid.
Prefer the main official international-student financial-aid page. If multiple official pages are necessary, use the strongest primary source as sourceUrl and summarize important additional official information.
Return ONLY valid JSON in exactly this shape:
{"sourceUrl":"https://official-university-url","category":"Full need / need-blind|Full need / need-aware|Need-based available / limited|Merit only|No institutional aid identified|Unclear","needBlind":true,"meetsFullNeed":true,"needBasedAvailable":true,"meritAvailable":false,"summary":"2–5 sentence precise explanation for an international undergraduate applicant."}
Do not infer policy from U.S.-citizen aid rules. If the official policy is ambiguous, use category Unclear rather than guessing.`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405, origin);

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    if (body.action === 'list') {
      const { data, error } = await supabase
        .from('school_research_cache')
        .select('school_key,school_name,research_type,payload,source_url,checked_at,expires_at')
        .order('school_key');
      if (error) throw error;
      return json({ rows: data || [] }, 200, origin);
    }

    const { schoolKey, schoolName, type, force = false, lookupOnly = false } = body;
    if (!schoolKey || !['setter', 'aid'].includes(type)) {
      return json({ error: 'schoolKey and type=setter|aid are required' }, 400, origin);
    }

    const { data: existing, error: readError } = await supabase
      .from('school_research_cache')
      .select('*')
      .eq('school_key', schoolKey)
      .eq('research_type', type)
      .maybeSingle();
    if (readError) throw readError;

    const now = Date.now();
    const fresh = existing && new Date(existing.expires_at).getTime() > now;
    if (fresh || lookupOnly) {
      return json({
        cached: !!existing,
        fresh: !!fresh,
        payload: existing?.payload || null,
        checkedAt: existing?.checked_at || null,
        expiresAt: existing?.expires_at || null,
        sourceUrl: existing?.source_url || null
      }, 200, origin);
    }

    if (!schoolName) return json({ error: 'schoolName is required when research is needed' }, 400, origin);

    const payload = await callResearchWorker(type === 'setter' ? setterPrompt(schoolName) : aidPrompt(schoolName));
    const ttlDays = type === 'setter' ? SETTER_TTL_DAYS : AID_TTL_DAYS;
    const checkedAt = new Date().toISOString();
    const expiresAt = new Date(now + ttlDays * 86400000).toISOString();
    const sourceUrl = type === 'setter' ? (payload.pageUrl || null) : (payload.sourceUrl || null);

    const { error: writeError } = await supabase
      .from('school_research_cache')
      .upsert({ school_key: schoolKey, school_name: schoolName, research_type: type, payload, source_url: sourceUrl, checked_at: checkedAt, expires_at: expiresAt }, { onConflict: 'school_key,research_type' });
    if (writeError) throw writeError;

    return json({ cached: false, fresh: true, payload, checkedAt, expiresAt, sourceUrl }, 200, origin);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500, origin);
  }
});
