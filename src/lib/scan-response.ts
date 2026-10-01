import { MAX_PHOTO_BYTES, sanitizeCluePhoto } from './clue-photo.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const socialPlatforms = ['tiktok', 'facebook', 'instagram'] as const;

export type FormValues = {
  scanEventId: string;
  disposition: string;
  socialPlatform: string;
  socialHandle: string;
  socialConsent: boolean;
  email: string;
  emailConsent: boolean;
  clueText: string;
  gpsConsent: boolean;
  deviceLocationConsent: boolean;
};

export type Submission = {
  scanEventId: string;
  disposition: 'keep' | 'rehide';
  socialPlatform: 'tiktok' | 'facebook' | 'instagram' | null;
  socialHandle: string | null;
  email: string | null;
  clueText: string | null;
  photo: Uint8Array | null;
  locationSource: 'photo' | 'device' | null;
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
    clueText: '',
    gpsConsent: false,
    deviceLocationConsent: false,
  };
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function parseScanResponse(form: FormData): Promise<{
  values: FormValues;
  errors: string[];
  submission: Submission | null;
}> {
  const values: FormValues = {
    scanEventId: field(form, 'scan_event_id'),
    disposition: field(form, 'disposition'),
    socialPlatform: field(form, 'social_platform'),
    socialHandle: field(form, 'social_handle').replace(/^@/, ''),
    socialConsent: form.has('social_consent'),
    email: field(form, 'email'),
    emailConsent: form.has('email_consent'),
    clueText: field(form, 'clue_text').replace(/\s+/g, ' '),
    gpsConsent: form.has('gps_consent'),
    deviceLocationConsent: form.has('device_location_consent'),
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

  if (values.disposition === 'keep' && values.clueText !== '') {
    errors.push('Un indice est réservé aux figurines cachées de nouveau.');
  }
  if (values.clueText.length > 160) errors.push('Limitez l’indice à 160 caractères.');
  if (/[\p{N}@]|https?:\/\/|www\.|\b(?:rue|avenue|boulevard|chemin|route|rang|adresse|coordonn[eé]es|latitude|longitude|postal|street|road|gps)\b/iu.test(values.clueText)) {
    errors.push('L’indice doit rester général : aucune adresse, coordonnée, lien ou numéro.');
  }

  let photo: Uint8Array | null = null;
  let locationSource: 'photo' | 'device' | null = null;
  const requestedSource = field(form, 'location_source');
  if (requestedSource && requestedSource !== 'photo' && requestedSource !== 'device') {
    errors.push('La source des coordonnées GPS est invalide.');
  }
  if (requestedSource === 'photo' && !values.gpsConsent) errors.push('Autorisez le GPS de la photo pour le conserver.');
  if (requestedSource === 'device' && !values.deviceLocationConsent) errors.push('Autorisez séparément la position actuelle pour la conserver.');

  const uploaded = form.get('clue_photo');
  if (uploaded instanceof File && uploaded.size > 0) {
    if (values.disposition !== 'rehide') errors.push('Une photo est réservée aux figurines cachées de nouveau.');
    if (uploaded.type !== 'image/jpeg' || uploaded.size > MAX_PHOTO_BYTES) {
      errors.push('La photo doit être un JPEG réduit de 300 Ko ou moins.');
    } else {
      try {
        const result = sanitizeCluePhoto(
          new Uint8Array(await uploaded.arrayBuffer()),
          (requestedSource === 'photo' && values.gpsConsent) ||
          (requestedSource === 'device' && values.deviceLocationConsent) ||
          (requestedSource === '' && values.gpsConsent),
        );
        photo = result.jpeg;
        if (result.hasGps) {
          locationSource = requestedSource === 'device' ? 'device' : 'photo';
        } else if (requestedSource || values.gpsConsent || values.deviceLocationConsent) {
          errors.push('Aucune coordonnée GPS disponible. Décochez les consentements ou utilisez la position actuelle.');
        }
      } catch {
        errors.push('La photo JPEG est invalide ou trop volumineuse.');
      }
    }
  } else if (values.gpsConsent || values.deviceLocationConsent || requestedSource) {
    errors.push('Ajoutez une photo pour autoriser la conservation de sa position.');
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
      clueText: values.disposition === 'rehide' ? values.clueText || null : null,
      photo,
      locationSource,
    },
  };
}

export async function saveScanResponse(db: D1Database, itemId: string, submission: Submission): Promise<'saved' | 'invalid_scan' | 'already_submitted'> {
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

  if (submission.photo) {
    const sanitized = sanitizeCluePhoto(submission.photo, submission.locationSource !== null);
    statements.push(db.prepare(`INSERT INTO scan_response_photos
      (scan_event_id, jpeg, gps_consent_at, location_source, device_location_consent_at) VALUES (?, ?, ?, ?, ?)`).bind(
      submission.scanEventId,
      sanitized.jpeg,
      submission.locationSource === 'photo' && sanitized.hasGps ? consentAt : null,
      sanitized.hasGps ? submission.locationSource : null,
      submission.locationSource === 'device' && sanitized.hasGps ? consentAt : null,
    ));
  }

  await db.batch(statements);
  return 'saved';
}
