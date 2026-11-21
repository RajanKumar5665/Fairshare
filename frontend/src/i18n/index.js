// Merges the per-area phrase files into one lookup: PHRASES[lang][englishText].
import app from './app';
import room from './room';
import auth from './auth';

const parts = [app, room, auth];
export const PHRASES = {
  hinglish: Object.assign({}, ...parts.map((p) => p.hinglish || {})),
  hi: Object.assign({}, ...parts.map((p) => p.hi || {})),
};
