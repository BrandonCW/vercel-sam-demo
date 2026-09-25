import { describe, it, expect } from 'vitest';
import * as turns from '@/lib/assessment-turns';
import { assessTurnMessage, saAnswerText } from '@/lib/assessment-turns';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';

describe('Assessment Session turn contract', () => {
  it('asks the root agent for one run_assessment call with the opportunity and model', () => {
    const message = assessTurnMessage('opp_acme_corp_001', 'anthropic/claude-sonnet-5');
    expect(message).toMatch(/call run_assessment with opportunityId opp_acme_corp_001 and model anthropic\/claude-sonnet-5/);
    expect(message).not.toMatch(/writebackWithoutFeedback/);
  });

  it('asks for the writeback without SA feedback only when requested', () => {
    expect(assessTurnMessage('opp_globex_fintech_002', 'google/gemini-3.8-flash', { writeback: true })).toMatch(
      /writebackWithoutFeedback true/
    );
  });

  it('encodes the SA answers as the JSON text run_assessment expects, keyed so tampering is detected', async () => {
    const text = await saAnswerText({ eb: 'CFO signs' }, 'Budget approved.');
    expect(JSON.parse(text)).toEqual({
      formResponses: { eb: 'CFO signs' },
      notesDelta: 'Budget approved.',
      feedbackKey: await saFeedbackKey({ eb: 'CFO signs' }, 'Budget approved.'),
    });
    expect(JSON.parse(await saAnswerText({ eb: 'CFO signs' }))).not.toHaveProperty('notesDelta');
  });

  it('asks for no structured turn outcome: code decides pass or fail from run_assessment', () => {
    expect(Object.keys(turns).sort()).toEqual(['assessTurnMessage', 'saAnswerText']);
  });
});
