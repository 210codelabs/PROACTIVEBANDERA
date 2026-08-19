// Public, keyless NLM RxNorm / RxNav + MedlinePlus Connect enrichment.
// Reference & normalization data only — NOT patient-specific clinical history.
// NOTE: NLM's RxNav drug-interaction API was retired Jan 2, 2024; interaction
// information in this app uses the openFDA drug label instead.

const RXNAV = "https://rxnav.nlm.nih.gov/REST";
const MEDLINE = "https://connect.medlineplus.gov/service";

export type RxNormMatch = { rxcui: string; name: string; tty: string; score?: number };
export type EducationLink = { title: string; url: string };
export type MedEnrichment = {
  query: string;
  matched: { rxcui: string; name: string; tty: string } | null;
  classes: string[];
  education: EducationLink[];
  source: string;
};

async function getJson(url: string, revalidate = 86400): Promise<any | null> {
  try {
    const r = await fetch(url, { next: { revalidate }, headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function rxnormApproximate(term: string): Promise<RxNormMatch | null> {
  const d = await getJson(`${RXNAV}/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=1`);
  const c = d?.approximateGroup?.candidate?.[0];
  if (!c?.rxcui) return null;
  return { rxcui: String(c.rxcui), name: c.name || "", tty: "", score: Number(c.score) || undefined };
}

export async function rxnormProperties(rxcui: string): Promise<{ name: string; tty: string } | null> {
  const d = await getJson(`${RXNAV}/rxcui/${encodeURIComponent(rxcui)}/properties.json`);
  const p = d?.properties;
  if (!p) return null;
  return { name: p.name || "", tty: p.tty || "" };
}

export async function rxnormClasses(rxcui: string): Promise<string[]> {
  const d = await getJson(`${RXNAV}/rxclass/class/byRxcui.json?rxcui=${encodeURIComponent(rxcui)}&relaSource=ATC`);
  const arr = d?.rxclassDrugInfoList?.rxclassDrugInfo || [];
  const names = new Set<string>();
  for (const x of arr) {
    const n = x?.rxclassMinConceptItem?.className;
    if (n) names.add(n);
  }
  return Array.from(names).slice(0, 6);
}

export async function medlinePlusByRxcui(rxcui: string): Promise<EducationLink[]> {
  const p = new URLSearchParams({
    "mainSearchCriteria.v.cs": "2.16.840.1.113883.6.88",
    "mainSearchCriteria.v.c": rxcui,
    "informationRecipient.languageCode.c": "en",
    knowledgeResponseType: "application/json",
  });
  const d = await getJson(`${MEDLINE}?${p.toString()}`);
  const entries = d?.feed?.entry || [];
  const links: EducationLink[] = [];
  for (const e of entries) {
    const title = e?.title?._value || (typeof e?.title === "string" ? e.title : "");
    const href = (Array.isArray(e?.link) ? e.link[0]?.href : e?.link?.href) || "";
    if (title && href) links.push({ title, url: href });
  }
  return links.slice(0, 4);
}

export async function enrichMedication(term: string): Promise<MedEnrichment> {
  const match = await rxnormApproximate(term);
  let classes: string[] = [];
  let education: EducationLink[] = [];
  let props: { name: string; tty: string } | null = null;
  if (match?.rxcui) {
    [props, classes, education] = await Promise.all([
      rxnormProperties(match.rxcui),
      rxnormClasses(match.rxcui),
      medlinePlusByRxcui(match.rxcui),
    ]);
  }
  return {
    query: term,
    matched: match ? { rxcui: match.rxcui, name: props?.name || match.name, tty: props?.tty || "" } : null,
    classes,
    education,
    source: "NLM RxNorm/RxNav + MedlinePlus Connect (public)",
  };
}
