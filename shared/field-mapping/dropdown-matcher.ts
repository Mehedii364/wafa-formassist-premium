export interface DropdownOption {
  value: string;
  text: string;
}

export interface DropdownMatchResult {
  matched: boolean;
  ambiguous: boolean;
  selectedValue: string | null;
  selectedText: string | null;
  suggestedCandidate: DropdownOption | null;
  strategy:
    | 'exact_value'
    | 'exact_text'
    | 'normalized_spelling'
    | 'bilingual_equivalent'
    | 'suggested_fuzzy'
    | 'ambiguous'
    | 'unresolved';
  candidates: DropdownOption[];
}

const BILINGUAL_EQUIVALENTS: Record<string, string[]> = {
  islam: ['ইসলাম', 'muslim', 'মুসলিম'],
  hinduism: ['হিন্দু', 'হিন্দু ধর্ম', 'hindu'],
  christianity: ['খ্রিস্টান', 'খ্রিস্ট ধর্ম', 'christian'],
  buddhism: ['বৌদ্ধ', 'বৌদ্ধ ধর্ম', 'buddhist'],
  male: ['পুরুষ', 'm'],
  female: ['মহিলা', 'নারী', 'f'],
  'third gender': ['তৃতীয় লিঙ্গ', 'other'],
  single: ['অবিবাহিত', 'unmarried'],
  married: ['বিবাহিত'],
  bangladeshi: ['বাংলাদেশী', 'বাংলাদেশি', 'bangladesh'],
  'non quota': ['কোটা নেই', 'none', 'general', 'সাধারণ'],
  'freedom fighter': ['মুক্তিযোদ্ধা', 'মুক্তিযোদ্ধা কোটা', 'ff'],
  'physically handicapped': ['শারীরিক প্রতিবন্ধী', 'physically challenged', 'handicapped'],
  orphan: ['এতিম'],
  'ethnic minority': ['ক্ষুদ্র নৃ-গোষ্ঠী', 'tribal'],
  dhaka: ['ঢাকা'],
  chattogram: ['চট্টগ্রাম', 'chittagong'],
  cumilla: ['কুমিল্লা', 'comilla'],
  jashore: ['যশোর', 'jessore'],
  bogura: ['বগুড়া', 'bogra'],
  barishal: ['বরিশাল', 'barisal'],
  rajshahi: ['রাজশাহী'],
  sylhet: ['সিলেট'],
  khulna: ['খুলনা'],
  rangpur: ['রংপুর'],
  mymensingh: ['ময়মনসিংহ'],
  dinajpur: ['দিনাজপুর'],
  science: ['বিজ্ঞান'],
  'business studies': ['ব্যবসায় শিক্ষা', 'commerce'],
  humanities: ['মানবিক', 'arts'],
  madrasah: ['মাদ্রাসা', 'madrasha'],
  technical: ['কারিগরি'],
};

export function normalizeOptionToken(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[._\-/(),[\]]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getEquivalents(normalized: string): Set<string> {
  const set = new Set<string>([normalized]);
  for (const [canonical, synonyms] of Object.entries(BILINGUAL_EQUIVALENTS)) {
    const all = [canonical, ...synonyms.map(normalizeOptionToken)];
    if (all.includes(normalized)) {
      all.forEach((token) => set.add(token));
    }
  }
  return set;
}

/**
 * Safely matches a profile value against real <select> options.
 * Never invents options, never auto-selects uncertain/fuzzy partial matches,
 * and refuses to auto-select when multiple candidates are ambiguous.
 */
export function matchDropdownOption(
  profileValue: string,
  options: DropdownOption[],
): DropdownMatchResult {
  const trimmed = (profileValue || '').trim();
  if (!trimmed || !options || options.length === 0) {
    return {
      matched: false,
      ambiguous: false,
      selectedValue: null,
      selectedText: null,
      suggestedCandidate: null,
      strategy: 'unresolved',
      candidates: [],
    };
  }

  // Filter out placeholder options ("Select One", "--Select--", empty value)
  const validOptions = options.filter((opt) => {
    const t = normalizeOptionToken(opt.text);
    const v = opt.value.trim();
    if (!v && (t === '' || t.startsWith('select') || t.startsWith('নির্বাচন'))) {
      return false;
    }
    return true;
  });

  // 1. Exact value match
  const exactValueMatches = validOptions.filter((o) => o.value.trim() === trimmed);
  if (exactValueMatches.length === 1) {
    return {
      matched: true,
      ambiguous: false,
      selectedValue: exactValueMatches[0].value,
      selectedText: exactValueMatches[0].text,
      suggestedCandidate: null,
      strategy: 'exact_value',
      candidates: exactValueMatches,
    };
  }

  // 2. Exact visible text match (case-insensitive)
  const exactTextMatches = validOptions.filter(
    (o) => o.text.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (exactTextMatches.length === 1) {
    return {
      matched: true,
      ambiguous: false,
      selectedValue: exactTextMatches[0].value,
      selectedText: exactTextMatches[0].text,
      suggestedCandidate: null,
      strategy: 'exact_text',
      candidates: exactTextMatches,
    };
  }

  // 3. Normalized spelling match
  const normTarget = normalizeOptionToken(trimmed);
  const normMatches = validOptions.filter(
    (o) =>
      normalizeOptionToken(o.text) === normTarget ||
      normalizeOptionToken(o.value) === normTarget,
  );
  if (normMatches.length === 1) {
    return {
      matched: true,
      ambiguous: false,
      selectedValue: normMatches[0].value,
      selectedText: normMatches[0].text,
      suggestedCandidate: null,
      strategy: 'normalized_spelling',
      candidates: normMatches,
    };
  }
  if (normMatches.length > 1) {
    return {
      matched: false,
      ambiguous: true,
      selectedValue: null,
      selectedText: null,
      suggestedCandidate: null,
      strategy: 'ambiguous',
      candidates: normMatches,
    };
  }

  // 4. Verified Bengali <-> English equivalent match
  const equivalents = getEquivalents(normTarget);
  const equivMatches = validOptions.filter((o) => {
    const nt = normalizeOptionToken(o.text);
    const nv = normalizeOptionToken(o.value);
    return equivalents.has(nt) || equivalents.has(nv);
  });
  if (equivMatches.length === 1) {
    return {
      matched: true,
      ambiguous: false,
      selectedValue: equivMatches[0].value,
      selectedText: equivMatches[0].text,
      suggestedCandidate: null,
      strategy: 'bilingual_equivalent',
      candidates: equivMatches,
    };
  }
  if (equivMatches.length > 1) {
    return {
      matched: false,
      ambiguous: true,
      selectedValue: null,
      selectedText: null,
      suggestedCandidate: null,
      strategy: 'ambiguous',
      candidates: equivMatches,
    };
  }

  // 5. Partial / fuzzy containment check -> NEVER auto-select!
  // Surface as suggested_fuzzy (single candidate) or ambiguous (>1 candidates) for manual confirmation.
  const wordMatches = validOptions.filter((o) => {
    const nt = normalizeOptionToken(o.text);
    return (
      (nt.length >= 3 && normTarget.length >= 3 && nt.includes(normTarget)) ||
      (nt.length >= 3 && normTarget.includes(nt))
    );
  });
  if (wordMatches.length === 1) {
    return {
      matched: false,
      ambiguous: false,
      selectedValue: null,
      selectedText: null,
      suggestedCandidate: wordMatches[0],
      strategy: 'suggested_fuzzy',
      candidates: wordMatches,
    };
  }
  if (wordMatches.length > 1) {
    return {
      matched: false,
      ambiguous: true,
      selectedValue: null,
      selectedText: null,
      suggestedCandidate: null,
      strategy: 'ambiguous',
      candidates: wordMatches,
    };
  }

  return {
    matched: false,
    ambiguous: false,
    selectedValue: null,
    selectedText: null,
    suggestedCandidate: null,
    strategy: 'unresolved',
    candidates: [],
  };
}
