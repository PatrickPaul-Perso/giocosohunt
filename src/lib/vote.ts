export type VoteCandidate = { id: string; name: string; description: string | null };

export type VoteValues = { email: string; contactConsent: boolean; choice: string; proposedName: string };
export type VoteSubmission = { email: string; normalizedEmail: string; choiceType: 'candidate' | 'proposal'; candidateId: string | null; proposedName: string | null };

export function parseVote(form: FormData, candidates: VoteCandidate[]): { values: VoteValues; errors: string[]; submission: VoteSubmission | null } {
  const get = (key: string) => String(form.get(key) ?? '').trim();
  const values: VoteValues = {
    email: get('email'),
    contactConsent: form.has('contact_consent'),
    choice: get('choice'),
    proposedName: get('proposed_name').replace(/\s+/g, ' '),
  };
  const errors: string[] = [];
  if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('email');
  if (!values.contactConsent) errors.push('contact_consent');
  if (values.choice === 'proposal') {
    if (values.proposedName.length < 2 || values.proposedName.length > 60 || /[@<>]|https?:\/\//i.test(values.proposedName)) errors.push('proposed_name');
  } else if (!candidates.some(({ id }) => id === values.choice) || values.proposedName !== '') errors.push('choice');
  return {
    values,
    errors,
    submission: errors.length ? null : {
      email: values.email,
      normalizedEmail: values.email.toLowerCase(),
      choiceType: values.choice === 'proposal' ? 'proposal' : 'candidate',
      candidateId: values.choice === 'proposal' ? null : values.choice,
      proposedName: values.choice === 'proposal' ? values.proposedName : null,
    },
  };
}

export async function saveVote(db: D1Database, campaignId: string, vote: VoteSubmission): Promise<void> {
  await db.prepare(`INSERT INTO vote_entries
    (id, campaign_id, email, email_normalized, contact_consent_at, choice_type, candidate_id, proposed_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, email_normalized) DO UPDATE SET
      email = excluded.email,
      contact_consent_at = excluded.contact_consent_at,
      choice_type = excluded.choice_type,
      candidate_id = excluded.candidate_id,
      proposed_name = excluded.proposed_name,
      updated_at = CURRENT_TIMESTAMP`)
    .bind(crypto.randomUUID(), campaignId, vote.email, vote.normalizedEmail, new Date().toISOString(), vote.choiceType, vote.candidateId, vote.proposedName)
    .run();
}
