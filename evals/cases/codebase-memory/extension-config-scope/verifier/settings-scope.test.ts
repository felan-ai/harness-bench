import { describe, expect, it } from 'vitest';
import { WEB_ACCESS_CONFIG } from '@felan-ai/ext-web-access';
import { resolveExtensionConfigSettings } from '../src/settings.js';

describe('resolveExtensionConfigSettings scope handling', () => {
  it('drops a session-scoped field from settings.json and warns', () => {
    const result = resolveExtensionConfigSettings(
      {
        extensionConfig: {
          webAccess: {
            openaiApiKey: 'sk-should-be-ignored',
            searxngBaseUrl: 'https://searx.example',
          },
        },
      },
      [WEB_ACCESS_CONFIG],
    );

    const applied = result.configs.get('webAccess');
    // session-scoped -> never applied, stays at the field default
    expect(applied?.openaiApiKey).toBe('');
    // user-scoped -> applied normally
    expect(applied?.searxngBaseUrl).toBe('https://searx.example');

    expect(result.warnings.some((w) => w.includes('session-scoped'))).toBe(true);
    const override = result.overrides.find((o) => o.extensionId === 'webAccess');
    expect(override?.values.openaiApiKey).toBeUndefined();
    expect(override?.values.searxngBaseUrl).toBe('https://searx.example');
  });
});
