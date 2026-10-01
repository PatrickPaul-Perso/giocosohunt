import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseVote, type VoteCandidate } from './vote.ts';

const candidates: VoteCandidate[] = [{ id: 'candidate-1', name: 'Modèle #1', description: null }];

function vote(entries: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return parseVote(form, candidates);
}

test('le vote exige un courriel et son consentement de contact', () => {
  assert.equal(vote({ choice: 'candidate-1' }).submission, null);
  assert.equal(vote({ choice: 'candidate-1', email: 'test@example.ca' }).submission, null);
  const result = vote({ choice: 'candidate-1', email: 'TEST@Example.ca', contact_consent: 'on' });
  assert.deepEqual(result.errors, []);
  assert.equal(result.submission?.normalizedEmail, 'test@example.ca');
});

test('une proposition et un choix existant sont exclusifs', () => {
  const proposal = vote({ choice: 'proposal', proposed_name: 'Un dragon', email: 'test@example.ca', contact_consent: 'on' });
  assert.equal(proposal.submission?.choiceType, 'proposal');
  assert.equal(proposal.submission?.proposedName, 'Un dragon');
  assert.equal(vote({ choice: 'candidate-1', proposed_name: 'Un dragon', email: 'test@example.ca', contact_consent: 'on' }).submission, null);
  assert.equal(vote({ choice: 'other', email: 'test@example.ca', contact_consent: 'on' }).submission, null);
});
