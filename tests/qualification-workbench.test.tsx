// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QualificationWorkbench } from '@/components/workbench/QualificationWorkbench';
import fixtureRaw from '@/lib/fixtures/simulation/acme_migration.json';

describe('QualificationWorkbench Component & Desk OS Flow', () => {
  const opportunity = fixtureRaw.opportunity as any;

  it('renders in Simulation Mode by default with Desk OS split layout and Acme Corp baseline data', () => {
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Header checks
    expect(screen.getByText('DEAL OPERATIONS')).toBeDefined();
    expect(screen.getByText('Qualification System')).toBeDefined();
    expect(screen.getByRole('button', { name: /Workbench settings|Settings/i })).toBeDefined();

    // Zero raw enums or demo pill
    const header = screen.getByRole('banner');
    expect(header.textContent).not.toContain('Salesforce connected');

    // Context & Desk OS 3-Stage Stepper
    expect(screen.getAllByText(/Acme Corp/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Initial Deal Audit/i)).toBeDefined();
    expect(screen.getByText(/Field Discovery Checklist/i)).toBeDefined();
    expect(screen.getByText(/Updated Assessment & Next Steps/i)).toBeDefined();

    // Blank Start State (Pre-Audit)
    expect(screen.getByText(/Stage Gate 2 · Unassessed Opportunity/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Start assessment/i })).toBeDefined();
    expect(screen.getByText(/Run MEDDPICC Deal Audit →/i)).toBeDefined();
  });

  it('toggles between Simulation Mode and Live AI Mode without mocked state bleed', async () => {
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    const settingsBtn = screen.getByRole('button', { name: /Workbench settings|Settings/i });
    await act(async () => {
      fireEvent.click(settingsBtn);
    });

    const liveBtn = screen.getByText(/Live AI mode/i);
    await act(async () => {
      fireEvent.click(liveBtn);
    });

    // In Live Mode, live workbench CTA is rendered
    expect(screen.getByText(/Run MEDDPICC Deal Audit — Start Assessment/i)).toBeDefined();

    const simBtn = screen.getByText(/Simulation mode/i);
    await act(async () => {
      fireEvent.click(simBtn);
    });

    // Back in Simulation Mode
    expect(screen.getByText(/Run MEDDPICC Deal Audit →/i)).toBeDefined();
  });

  it('progresses sequentially and supports stepping back to the previous stage with input preservation', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Click Start assessment to advance from blank to ANALYZING
    const startBtn = screen.getByRole('button', { name: /Start assessment/i });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    // Advance 1200ms timer to reach PENDING_FEEDBACK (Stage 1)
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Stage 1: Score 54, blocker pill, primary CTA
    expect(screen.getAllByText('54').length).toBeGreaterThan(0);
    expect(screen.getByText(/Stage Gate 2 · \d+ Gaps Identified/i)).toBeDefined();

    // Advance to Stage 2: Field Discovery Checklist
    const toStage2Btn = screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i });
    await act(async () => {
      fireEvent.click(toStage2Btn);
    });

    // In Stage 2, discovery form rendered
    expect(screen.getByText(/Submit Discovery Findings & Re-Score Deal/i)).toBeDefined();
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

    // Verify Stage 1 is visible
    expect(screen.getByText(/Stage Gate 2 · \d+ Gaps Identified/i)).toBeDefined();

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

  it('completes assessment and allows inspecting Stage 1 and Stage 2 without state loss', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Advance to Stage 1
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Advance to Stage 2
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i }));
    });

    // Fill required discovery fields
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

    // Advance evaluation timer
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Stage 3: Score 76, Gate Criteria Satisfied
    expect(screen.getAllByText('76').length).toBeGreaterThan(0);
    expect(screen.getByText(/Stage Gate 2 · Gate Criteria Satisfied/i)).toBeDefined();
    expect(screen.getByText(/Suggested Next Steps/i)).toBeDefined();

    // Inspect Stage 1 via StepperBar
    const stage1Step = screen.getByRole('button', { name: /Initial Deal Audit/i });
    await act(async () => {
      fireEvent.click(stage1Step);
    });
    expect(screen.getByText(/Return to Updated Assessment \(Stage 3\) →/i)).toBeDefined();

    // Return to Stage 3
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Return to Updated Assessment \(Stage 3\)/i }));
    });
    expect(screen.getAllByText('76').length).toBeGreaterThan(0);

    // Inspect Stage 2 via StepperBar
    const stage2Step = screen.getByRole('button', { name: /Field Discovery Checklist/i });
    await act(async () => {
      fireEvent.click(stage2Step);
    });
    expect(screen.getByRole('button', { name: /Return to Updated Assessment \(Stage 3\)/i })).toBeDefined();

    vi.useRealTimers();
  });

  it('resets back to baseline on Restart button click', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Advance to Stage 1
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Advance to Stage 2 and fill required fields
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i }));
    });
    const radioOption = screen.getByRole('radio', {
      name: /Confirmed sponsorship if build times drop <5 min/i,
    });
    fireEvent.click(radioOption);
    const criteriaSelect = screen.getByLabelText(/Confirmed technical decision criteria/i);
    fireEvent.change(criteriaSelect, { target: { value: 'build_speed_and_isr' } });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Discovery Findings/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // In Stage 3, click ↺ Restart Walkthrough
    const restartBtn = screen.getByRole('button', { name: /Restart Walkthrough/i });
    await act(async () => {
      fireEvent.click(restartBtn);
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

    // Advance to Stage 1
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Advance to Stage 2 and fill required fields
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i }));
    });
    const radioOption = screen.getByRole('radio', {
      name: /Confirmed sponsorship if build times drop <5 min/i,
    });
    fireEvent.click(radioOption);
    const criteriaSelect = screen.getByLabelText(/Confirmed technical decision criteria/i);
    fireEvent.change(criteriaSelect, { target: { value: 'build_speed_and_isr' } });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Discovery Findings/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    const copyBtn = screen.getByRole('button', { name: /Copy Next Steps/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByText('✓ Copied to Clipboard')).toBeDefined();

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

    // Advance to Stage 1
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Advance to Stage 2 and fill required fields
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i }));
    });
    const radioOption = screen.getByRole('radio', {
      name: /Confirmed sponsorship if build times drop <5 min/i,
    });
    fireEvent.click(radioOption);
    const criteriaSelect = screen.getByLabelText(/Confirmed technical decision criteria/i);
    fireEvent.change(criteriaSelect, { target: { value: 'build_speed_and_isr' } });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Discovery Findings/i }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    const copyBtn = screen.getByRole('button', { name: /Copy Next Steps/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByText('Copy Failed — Select text below manually')).toBeDefined();

    vi.useRealTimers();
  });

  it('switches simulation scenarios dynamically, updating Deal Context card, baseline scores, and discovery questions', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Initial state: Acme Corp
    expect(screen.getAllByText(/Acme Corp/i).length).toBeGreaterThan(0);

    // Open settings and switch to Globex FinTech scenario
    const settingsBtn = screen.getByRole('button', { name: /Workbench settings|Settings/i });
    await act(async () => {
      fireEvent.click(settingsBtn);
    });

    const scenarioSelect = screen.getByLabelText(/Select Scenario/i);
    await act(async () => {
      fireEvent.change(scenarioSelect, { target: { value: 'scenario_globex_amplify' } });
    });

    // Close settings dialog
    const closeBtn = screen.getByRole('button', { name: /Close settings/i });
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // Deal Context card should reflect Globex FinTech ($240,000 ACV, AWS Amplify competitor)
    expect(screen.getAllByText(/Globex/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$240,000/i)).toBeDefined();
    expect(screen.getAllByText(/AWS Amplify/i).length).toBeGreaterThan(0);

    // Workbench should be in blank unassessed state for the new scenario
    expect(screen.getByText(/Stage Gate 2 · Unassessed Opportunity/i)).toBeDefined();

    // Start assessment for Globex
    const startBtn = screen.getByRole('button', { name: /Start assessment/i });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    // Advance 1200ms timer to reach PENDING_FEEDBACK
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Globex baseline MEDDPICC score is 48
    expect(screen.getAllByText('48').length).toBeGreaterThan(0);

    // Advance to Stage 2: Field Discovery Checklist
    const toStage2Btn = screen.getByRole('button', { name: /Answer \d+ Discovery Questions/i });
    await act(async () => {
      fireEvent.click(toStage2Btn);
    });

    // Globex discovery questions target Secure Compute / VPC Peering and InfoSec SOC2
    expect(
      screen.getByText(/Confirmed Vercel Secure Compute VPC peering and dedicated egress IP architecture\?/i)
    ).toBeDefined();

    // Now open settings and switch scenario to Soylent Retail
    await act(async () => {
      fireEvent.click(settingsBtn);
    });
    const soylentSelect = screen.getByLabelText(/Select Scenario/i);
    await act(async () => {
      fireEvent.change(soylentSelect, { target: { value: 'scenario_soylent_headless' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Close settings/i }));
    });

    // Deal Context card reflects Soylent Retail ($90,000 ACV)
    expect(screen.getAllByText(/Soylent/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$90,000/i)).toBeDefined();

    // Start assessment for Soylent
    const startSoylentBtn = screen.getByRole('button', { name: /Start assessment/i });
    await act(async () => {
      fireEvent.click(startSoylentBtn);
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Soylent baseline MEDDPICC score is 52
    expect(screen.getAllByText('52').length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});
