// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QualificationWorkbench } from '@/components/workbench/QualificationWorkbench';
import acmeFixture from '@/lib/fixtures/simulation/acme_migration.json';
import globexFixture from '@/lib/fixtures/simulation/globex_amplify.json';
import soylentFixture from '@/lib/fixtures/simulation/soylent_retail.json';

describe('QualificationWorkbench Component & Desk OS Flow', () => {
  const opportunity = acmeFixture.opportunity as any;
  const acmeBaselineScore = String(acmeFixture.baseline.jevResult.overallScore);
  const acmeFinalScore = String(acmeFixture.feedback.rescoreJevResult.overallScore);
  const globexBaselineScore = String(globexFixture.baseline.jevResult.overallScore);
  const soylentBaselineScore = String(soylentFixture.baseline.jevResult.overallScore);

  it('renders in Simulation Mode by default with visible monochrome SIMULATION pill and zero System 1/2 jargon or redundant status pills', () => {
    const { container } = render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Header checks
    expect(screen.getByText('DEAL OPERATIONS')).toBeDefined();
    expect(screen.getByText('Qualification System')).toBeDefined();
    expect(screen.getByRole('button', { name: /Workbench settings/i })).toBeDefined();

    // Visible monochrome SIMULATION pill immediately left of Settings
    const simPill = screen.getByRole('button', { name: /^SIMULATION$/i });
    expect(simPill).toBeDefined();
    expect(simPill.getAttribute('title')).toBe(
      'AI Simulation mode (deterministic responses) — click to switch to Live AI'
    );
    expect(simPill.className).toContain('bg-[#F1F0EC]');

    // Zero raw enums, demo pill, or System 1/2 jargon
    const header = screen.getByRole('banner');
    expect(header.textContent).not.toContain('Salesforce connected');
    expect(container.textContent).not.toMatch(/System 1|System 2|\bJev\b|Demo Scenario|Reset Demo/i);

    // Context & Desk OS 3-Stage Stepper
    expect(screen.getAllByText(/Acme Corp/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Initial Deal Audit/i)).toBeDefined();
    expect(screen.getByText(/Field Discovery/i)).toBeDefined();
    expect(screen.getByText(/Updated Assessment/i)).toBeDefined();

    // Blank Start State (Pre-Audit) — no redundant 'Unassessed' pills or '[I]' brackets
    expect(screen.getByText(/Stage Gate 2 · Unassessed Opportunity/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Start assessment/i })).toBeDefined();
    expect(screen.getByText('Run MEDDPICC Deal Audit →')).toBeDefined();
    expect(screen.queryByText('Unassessed')).toBeNull();
    expect(screen.queryByText('[I]')).toBeNull();
    expect(screen.getByText(/I · Weight 20%/)).toBeDefined();
  });

  it('opens Settings from SIMULATION pill, dims/disables analysis model in Simulation mode, and toggles cleanly to Live AI mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ sessionId: 'wrun_PREWARM' }), { status: 200 }))
    );
    try {
      render(<QualificationWorkbench initialOpportunity={opportunity} />);

      const simPill = screen.getByRole('button', { name: /^SIMULATION$/i });
      await act(async () => {
        fireEvent.click(simPill);
      });

      // In Simulation mode, model selector is disabled with explanatory helper text
      const modelSelect = screen.getByLabelText('Select analysis model');
      expect(modelSelect).toHaveProperty('disabled', true);
      expect(screen.getByText('Model selection applies in Live AI mode')).toBeDefined();

      const liveBtn = screen.getByRole('button', { name: /Live AI Inference/i });
      await act(async () => {
        fireEvent.click(liveBtn);
      });

      // TopNavBar pill flips to LIVE and Live workbench renders unified CTA label
      expect(screen.getByRole('button', { name: /^LIVE$/i })).toBeDefined();
      expect(screen.getByText('Run MEDDPICC Deal Audit →')).toBeDefined();

      const simBtn = screen.getByRole('button', { name: /Simulated AI \(Instant Replay\)/i });
      await act(async () => {
        fireEvent.click(simBtn);
      });

      // Back in Simulation Mode
      expect(screen.getByRole('button', { name: /^SIMULATION$/i })).toBeDefined();
      expect(screen.getByText('Run MEDDPICC Deal Audit →')).toBeDefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('mirrors 2-step progressive hydration in Simulation Mode (~350ms baseline scores + shimmers + Abort -> ~950ms citations & checklist)', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    const startBtn = screen.getByRole('button', { name: /Start assessment/i });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    // 0–350ms: single baseline rubric scanning indicator with Abort button
    expect(screen.getAllByText(/Scanning MEDDPICC rubric…/i)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Abort$/i })).toBeDefined();

    // Advance past 350ms -> Stage 1 unlocks immediately with baseline score, shimmers, progressive CTA, and Abort
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getAllByText(acmeBaselineScore).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Generating Discovery Checklist…/i })).toHaveProperty(
      'disabled',
      true
    );
    expect(screen.getByRole('button', { name: /^Abort$/i })).toBeDefined();
    expect(screen.getByTestId('evidence-shimmer-economicBuyer')).toBeDefined();

    // Advance past 950ms -> buyer citations, gaps, and discovery CTA hydrate
    await act(async () => {
      vi.advanceTimersByTime(650);
    });

    expect(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i })).toBeDefined();
    expect(screen.queryByTestId('evidence-shimmer-economicBuyer')).toBeNull();

    vi.useRealTimers();
  });

  it('progresses sequentially and supports stepping back to the previous stage with input preservation', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    const startBtn = screen.getByRole('button', { name: /Start assessment/i });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Stage 1: Baseline score, real Stage Gate blocker pill, primary CTA
    expect(screen.getAllByText(acmeBaselineScore).length).toBeGreaterThan(0);
    expect(screen.getByText(/Stage Gate 2 · \d+ Gate Blockers? Identified/i)).toBeDefined();

    // Advance to Stage 2: Field Discovery Checklist
    const toStage2Btn = screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i });
    await act(async () => {
      fireEvent.click(toStage2Btn);
    });

    // In Stage 2, discovery form rendered with baseline dimension score
    expect(screen.getByText(/Submit Discovery Findings & Re-Score Deal/i)).toBeDefined();
    expect(screen.getByText('Economic Buyer: 3/10')).toBeDefined();

    const radioOption = screen.getByRole('radio', {
      name: /Confirmed sponsorship if build times drop <5 min/i,
    });
    fireEvent.click(radioOption);
    expect(radioOption).toHaveProperty('checked', true);

    const notesTextarea = screen.getByLabelText(/Additional SA Notes/i);
    fireEvent.change(notesTextarea, {
      target: { value: 'Priya confirmed budget authority for $180k.' },
    });

    // Step back to Stage 1 via header "← Back to Audit"
    const backBtn = screen.getByRole('button', { name: /Back to Audit/i });
    await act(async () => {
      fireEvent.click(backBtn);
    });

    expect(screen.getByText(/Stage Gate 2 · \d+ Gate Blockers? Identified/i)).toBeDefined();

    // Navigate forward to Stage 2 again
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i }));
    });

    // Verify input preservation
    const restoredRadio = screen.getByRole('radio', {
      name: /Confirmed sponsorship if build times drop <5 min/i,
    });
    expect(restoredRadio).toHaveProperty('checked', true);
    const restoredNotes = screen.getByLabelText(/Additional SA Notes/i);
    expect(restoredNotes).toHaveProperty('value', 'Priya confirmed budget authority for $180k.');

    vi.useRealTimers();
  });

  it('completes assessment, shows honest simulation sync subtitle + CRM writeback card, and preserves baseline Stage 2 scores on retrospective inspection', async () => {
    vi.useFakeTimers();
    const { container } = render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Advance to Stage 1
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Advance to Stage 2
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i }));
    });

    const radioOption = screen.getByRole('radio', {
      name: /Confirmed sponsorship if build times drop <5 min/i,
    });
    fireEvent.click(radioOption);

    const criteriaSelect = screen.getByLabelText(/Confirmed technical decision criteria/i);
    fireEvent.change(criteriaSelect, { target: { value: 'build_speed_and_isr' } });

    // Submit Discovery Findings in Stage 2
    const submitBtn = screen.getByRole('button', { name: /Submit Discovery Findings/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Stage 3: Final score, Gate Criteria Satisfied, honest simulation preview subtitle, structured OWNER/FOCUS/WATCH metadata, zero [QUALIFIED] tag or '58 →' prefix
    expect(screen.getAllByText(acmeFinalScore).length).toBeGreaterThan(0);
    expect(screen.getByText(/Stage Gate 2 · Gate Criteria Satisfied/i)).toBeDefined();
    expect(screen.getByText('(+18)')).toBeDefined();
    expect(container.textContent).not.toContain('58 →');
    expect(container.textContent).not.toContain('3 →');
    expect(screen.queryByText(/Qualification Finalized/i)).toBeNull();
    expect(screen.getByText(/Suggested Next Steps/i)).toBeDefined();
    expect(screen.getByText(/Simulation preview/i)).toBeDefined();
    expect(screen.getByText('OWNER')).toBeDefined();
    expect(screen.getByText('David Kross (SA)')).toBeDefined();
    expect(screen.getByText('FOCUS')).toBeDefined();
    expect(screen.getByText('WATCH')).toBeDefined();
    expect(container.textContent).not.toContain('[QUALIFIED]');
    expect(screen.getByTestId('crm-qualification-status').textContent).toContain('Qualified');

    // Inspect Stage 1 via StepperBar — no redundant Blocker/Verified/Partial pills
    const stage1Step = screen.getByRole('button', { name: /Initial Deal Audit/i });
    await act(async () => {
      fireEvent.click(stage1Step);
    });
    expect(screen.getByText(/Return to Updated Assessment \(Stage 3\) →/i)).toBeDefined();
    expect(screen.queryByText('Blocker')).toBeNull();
    expect(screen.queryByText('Verified')).toBeNull();
    expect(screen.queryByText('Partial')).toBeNull();

    // Return to Stage 3
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Return to Updated Assessment \(Stage 3\)/i }));
    });
    expect(screen.getAllByText(acmeFinalScore).length).toBeGreaterThan(0);

    // Inspect Stage 2 via StepperBar — shows baseline 3/10 (not post-rescore 8/10)
    const stage2Step = screen.getByRole('button', { name: /Field Discovery/i });
    await act(async () => {
      fireEvent.click(stage2Step);
    });
    expect(screen.getByRole('button', { name: /Return to Updated Assessment \(Stage 3\)/i })).toBeDefined();
    expect(screen.getByText('Economic Buyer: 3/10')).toBeDefined();

    vi.useRealTimers();
  });

  it('resets back to baseline on Reset Opportunity Baseline button click', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i }));
    });
    const radioOption = screen.getByRole('radio', {
      name: /Confirmed sponsorship if build times drop <5 min/i,
    });
    fireEvent.click(radioOption);
    const criteriaSelect = screen.getByLabelText(/Confirmed technical decision criteria/i);
    fireEvent.change(criteriaSelect, { target: { value: 'build_speed_and_isr' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Discovery Findings/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // In Stage 3, click Reset Opportunity Baseline
    const resetBtn = screen.getByRole('button', { name: /Reset Opportunity Baseline/i });
    await act(async () => {
      fireEvent.click(resetBtn);
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Verified reset to unassessed blank state
    expect(screen.getByText(/Stage Gate 2 · Unassessed Opportunity/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Start assessment/i })).toBeDefined();

    vi.useRealTimers();
  });

  it('handles clipboard copy success in Stage 3', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i }));
    });
    fireEvent.click(
      screen.getByRole('radio', { name: /Confirmed sponsorship if build times drop <5 min/i })
    );
    fireEvent.change(screen.getByLabelText(/Confirmed technical decision criteria/i), {
      target: { value: 'build_speed_and_isr' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Discovery Findings/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const copyBtn = screen.getByRole('button', { name: /Copy Next Steps/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(writeTextMock.mock.calls[0][0]).not.toContain('[QUALIFIED]');
    expect(screen.getByText('Copied')).toBeDefined();

    vi.useRealTimers();
  });

  it('handles clipboard copy failure gracefully in Stage 3', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard write rejected'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i }));
    });
    fireEvent.click(
      screen.getByRole('radio', { name: /Confirmed sponsorship if build times drop <5 min/i })
    );
    fireEvent.change(screen.getByLabelText(/Confirmed technical decision criteria/i), {
      target: { value: 'build_speed_and_isr' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Discovery Findings/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const copyBtn = screen.getByRole('button', { name: /Copy Next Steps/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByText('Copy failed — select text below manually')).toBeDefined();

    vi.useRealTimers();
  });

  it('switches simulation scenarios dynamically across Acme, Globex, and Soylent', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    expect(screen.getAllByText(/Acme Corp/i).length).toBeGreaterThan(0);

    const settingsBtn = screen.getByRole('button', { name: /Workbench settings/i });
    await act(async () => {
      fireEvent.click(settingsBtn);
    });

    const scenarioSelect = screen.getByLabelText(/Select active opportunity/i);
    await act(async () => {
      fireEvent.change(scenarioSelect, { target: { value: 'scenario_globex_amplify' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Close settings/i }));
    });

    expect(screen.getAllByText(/Globex/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$240,000/i)).toBeDefined();
    expect(screen.getAllByText(/AWS Amplify/i).length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getAllByText(globexBaselineScore).length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i }));
    });

    expect(
      screen.getByText(/Confirmed Vercel Secure Compute VPC peering and dedicated egress IP architecture\?/i)
    ).toBeDefined();

    await act(async () => {
      fireEvent.click(settingsBtn);
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Select active opportunity/i), {
        target: { value: 'scenario_soylent_headless' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Close settings/i }));
    });

    expect(screen.getAllByText(/Soylent/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$90,000/i)).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getAllByText(soylentBaselineScore).length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});
