const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const socialPlatforms = ['tiktok', 'facebook', 'instagram'] as const;

export type Candidate = { id: string; name: string };
export type FormValues = {
  scanEventId: string;
  disposition: string;
  socialPlatform: string;
  socialHandle: string;
  socialConsent: boolean;
  email: string;
  emailConsent: boolean;
  modelChoice: string;
  proposalName: string;
  clueText: string;
};

export type Submission = {
  scanEventId: string;
  disposition: 'keep' | 'rehide';
  socialPlatform: 'tiktok' | 'facebook' | 'instagram' | null;
  socialHandle: string | null;
  email: string | null;
  modelChoice: string;
  proposalName: string | null;
  clueText: string | null;
};

export function emptyFormValues(scanEventId = ''): FormValues {
  return {
    scanEventId,
    disposition: '',
    socialPlatform: '',
    socialHandle: '',
    socialConsent: false,
    email: '',
    emailConsent: false,
    modelChoice: '',
    proposalName: '',
    clueText: '',
  };
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function parseScanResponse(form: FormData, candidates: Candidate[]): {
  values: FormValues;
  errors: string[];
  submission: Submission | null;
} {
  const values: FormValues = {
    scanEventId: field(form, 'scan_event_id'),
    disposition: field(form, 'disposition'),
    socialPlatform: field(form, 'social_platform'),
    socialHandle: field(form, 'social_handle').replace(/^@/, ''),
    socialConsent: form.has('social_consent'),
    email: field(form, 'email'),
    emailConsent: form.has('email_consent'),
    modelChoice: field(form, 'model_choice'),
    proposalName: field(form, 'proposal_name').replace(/\s+/g, ' '),
    clueText: field(form, 'clue_text').replace(/\s+/g, ' '),
  };
  const errors: string[] = [];

  if (!uuidPattern.test(values.scanEventId)) errors.push('Le scan est invalide. Ouvrez de nouveau la fiche de la figurine.');
  if (values.disposition !== 'keep' && values.disposition !== 'rehide') {
    errors.push('Indiquez si vous gardez ou cachez de nouveau la figurine.');
  }

  const hasSocialData = values.socialPlatform !== '' || values.socialHandle !== '';
  if (hasSocialData || values.socialConsent) {
    if (!socialPlatforms.includes(values.socialPlatform as (typeof socialPlatforms)[number])) {
      errors.push('Choisissez TikTok, Facebook ou Instagram pour le shoutout.');
    }
    if (!/^[\p{L}\p{N}._-]{1,50}$/u.test(values.socialHandle)) {
      errors.push('Entrez un handle valide, sans lien Web ni espace.');
    }
    if (!values.socialConsent) errors.push('Autorisez séparément le shoutout pour enregistrer votre handle.');
  }

  if (values.email !== '' || values.emailConsent) {
    if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.push('Entrez une adresse courriel valide.');
    }
    if (!values.emailConsent) errors.push('Autorisez séparément le contact par courriel pour enregistrer votre adresse.');
  }

  if (values.modelChoice === 'propose') {
    if (values.proposalName.length < 2 || values.proposalName.length > 60 || /[@<>]|https?:\/\//i.test(values.proposalName)) {
      errors.push('Proposez un nom de modèle de 2 à 60 caractères, sans lien ni coordonnée.');
    }
  } else if (!candidates.some((candidate) => candidate.id === values.modelChoice)) {
    errors.push('Choisissez un modèle dans la liste ou proposez-en un nouveau.');
  } else if (values.proposalName !== '') {
    errors.push('Effacez le nom proposé ou choisissez l’option de proposition.');
  }

  if (values.disposition === 'keep' && values.clueText !== '') {
    errors.push('Un indice est réservé aux figurines cachées de nouveau.');
  }
  if (values.clueText.length > 160) errors.push('Limitez l’indice à 160 caractères.');
  if (/[\p{N}@]|https?:\/\/|www\.|\b(?:rue|avenue|boulevard|chemin|route|rang|adresse|coordonn[eé]es|latitude|longitude|postal|street|road|gps)\b/iu.test(values.clueText)) {
    errors.push('L’indice doit rester général : aucune adresse, coordonnée, lien ou numéro.');
  }

  if (errors.length > 0) return { values, errors, submission: null };

  return {
    values,
    errors,
    submission: {
      scanEventId: values.scanEventId,
      disposition: values.disposition as 'keep' | 'rehide',
      socialPlatform: values.socialPlatform ? values.socialPlatform as Submission['socialPlatform'] : null,
      socialHandle: values.socialHandle || null,
      email: values.email || null,
      modelChoice: values.modelChoice,
      proposalName: values.modelChoice === 'propose' ? values.proposalName : null,
      clueText: values.disposition === 'rehide' ? values.clueText || null : null,
    },
  };
}

export async function saveScanResponse(db: D1Database, campaignId: string, itemId: string, submission: Submission): Promise<'saved' | 'invalid_scan' | 'already_submitted'> {
  const scan = await db.prepare('SELECT id FROM scan_events WHERE id = ? AND item_id = ?')
    .bind(submission.scanEventId, itemId)
    .first();
  if (!scan) return 'invalid_scan';

  const prior = await db.prepare('SELECT scan_event_id FROM scan_responses WHERE scan_event_id = ?')
    .bind(submission.scanEventId)
    .first();
  if (prior) return 'already_submitted';

  const consentAt = new Date().toISOString();
  const statements = [
    db.prepare(`INSERT INTO scan_responses
      (scan_event_id, disposition, social_platform, social_handle, social_consent_at, email, email_consent_at, clue_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      submission.scanEventId,
      submission.disposition,
      submission.socialPlatform,
      submission.socialHandle,
      submission.socialHandle ? consentAt : null,
      submission.email,
      submission.email ? consentAt : null,
      submission.clueText,
    ),
  ];

  if (submission.modelChoice === 'propose') {
    statements.push(db.prepare(`INSERT INTO model_proposals
      (id, campaign_id, proposed_name, scan_event_id) VALUES (?, ?, ?, ?)`).bind(
      crypto.randomUUID(), campaignId, submission.proposalName, submission.scanEventId,
    ));
  } else {
    statements.push(db.prepare(`INSERT INTO votes
      (id, campaign_id, candidate_id, scan_event_id) VALUES (?, ?, ?, ?)`).bind(
      crypto.randomUUID(), campaignId, submission.modelChoice, submission.scanEventId,
    ));
  }

  await db.batch(statements);
  return 'saved';
}
