/**
 * ElevenLabs quota.
 *
 * Synthesis is the only part of this pipeline that costs anything, and on the
 * free tier the budget is small enough that one careless run matters. Reading
 * the subscription is itself free, so there is no reason not to look before
 * spending and to say plainly what a run will cost.
 */

const API = "https://api.elevenlabs.io/v1";

export type Quota = {
  readonly tier: string;
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  /** When the allowance resets, if the API reports it. */
  readonly resetsAt: Date | null;
};

type SubscriptionResponse = {
  tier?: string;
  character_count?: number;
  character_limit?: number;
  next_character_count_reset_unix?: number;
};

/** Read the current allowance. Does not consume quota. */
export const fetchQuota = async (apiKey: string): Promise<Quota> => {
  const response = await fetch(`${API}/user/subscription`, {
    headers: { "xi-api-key": apiKey },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Could not read ElevenLabs quota (${response.status} ${response.statusText})` +
        `${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }

  const d = (await response.json()) as SubscriptionResponse;
  const used = d.character_count ?? 0;
  const limit = d.character_limit ?? 0;

  return {
    tier: d.tier ?? "unknown",
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: d.next_character_count_reset_unix
      ? new Date(d.next_character_count_reset_unix * 1000)
      : null,
  };
};

/**
 * What a script will cost.
 *
 * ElevenLabs bills per character of the text submitted, so this is exact
 * rather than an estimate — which is the point of showing it before the call.
 */
export const costOf = (text: string): number => text.length;

export type SpendCheck = {
  readonly cost: number;
  readonly quota: Quota | null;
  /** False when the quota is known and too small for this run. */
  readonly affordable: boolean;
  readonly remainingAfter: number | null;
};

export const checkSpend = async (text: string, apiKey: string): Promise<SpendCheck> => {
  const cost = costOf(text);
  try {
    const quota = await fetchQuota(apiKey);
    return {
      cost,
      quota,
      affordable: quota.remaining >= cost,
      remainingAfter: quota.remaining - cost,
    };
  } catch {
    // A quota read failing should not block a render the user has asked for;
    // report what we can and let them decide.
    return { cost, quota: null, affordable: true, remainingAfter: null };
  }
};

export const formatQuota = (q: Quota): string => {
  const pct = q.limit > 0 ? Math.round((q.used / q.limit) * 100) : 0;
  const reset = q.resetsAt
    ? ` · resets ${q.resetsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "";
  return `${q.remaining.toLocaleString()} of ${q.limit.toLocaleString()} characters left (${100 - pct}%, ${q.tier})${reset}`;
};
