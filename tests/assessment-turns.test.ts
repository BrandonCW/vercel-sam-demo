import { describe, it, expect } from 'vitest';
import { assessTurnMessage, feedbackTurnMessage, parseTurnRequest } from '@/lib/assessment-turns';

// The routes and the live evals send these exact turn messages.
describe('Assessment Session turn messages', () => {
  it('turn 1 asks for crm_read_deal, score_deal, analyze_deal with the model, and no writeback', () => {
    const message = assessTurnMessage('opp_acme_corp_001', 'anthropic/claude-sonnet-5');
    expect(message).toMatch(/opp_acme_corp_001: call crm_read_deal, then score_deal, then analyze_deal with model anthropic\/claude-sonnet-5/);
    expect(message).toMatch(/Do not write back to the CRM yet/);
  });

  it('turn 1 can ask for a writeback without SA feedback', () => {
    const message = assessTurnMessage('opp_globex_fintech_002', 'anthropic/claude-sonnet-5', { writeback: true });
    expect(message).toMatch(/then call crm_update_next_steps for opp_globex_fintech_002 without waiting for SA feedback/);
    expect(message).not.toMatch(/Do not write back/);
  });

  it('turn 2 carries the verbatim payload and its feedbackKey', () => {
    const payload = { opportunityId: 'opp_acme_corp_001', formResponses: { eb: 'CFO signs' }, notesDelta: 'n' };
    const message = feedbackTurnMessage(payload, 'abc123');
    expect(message).toContain('feedbackKey abc123');
    expect(message).toContain(JSON.stringify(payload));
    expect(message).toMatch(/record_sa_feedback.*score_deal.*crm_update_next_steps/s);
  });

  it('reads back what a turn message asked for, so the workbench can check the results against it', () => {
    expect(parseTurnRequest(assessTurnMessage('opp_acme_corp_001', 'openai/gpt-5.5'))).toEqual({ turn: 'assess', model: 'openai/gpt-5.5' });
    const payload = { opportunityId: 'opp_acme_corp_001', formResponses: { eb: 'CFO signs' } };
    expect(parseTurnRequest(feedbackTurnMessage(payload, 'abc123'))).toEqual({ turn: 'feedback', feedbackKey: 'abc123' });
    expect(parseTurnRequest('hello')).toBeNull();
  });
});
