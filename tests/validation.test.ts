import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidAudioUrl } from '../lib/validation';

test('accepts HTTPS audio links only', () => {
  assert.equal(isValidAudioUrl('https://www.instagram.com/reels/audio/123'), true);
  assert.equal(isValidAudioUrl('https://example.com/audio?id=1'), true);
  assert.equal(isValidAudioUrl('http://example.com/audio'), false);
  assert.equal(isValidAudioUrl('javascript:alert(1)'), false);
  assert.equal(isValidAudioUrl('data:text/html,hello'), false);
  assert.equal(isValidAudioUrl('https://user:pass@example.com'), false);
  assert.equal(isValidAudioUrl('not a URL'), false);
});
