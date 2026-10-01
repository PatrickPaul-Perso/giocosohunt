import { randomUUID } from 'node:crypto';

// Identifiant imprévisible pour un nouveau tag physique.
process.stdout.write(`${randomUUID()}\n`);
