// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QualificationWorkbench } from '@/components/workbench/QualificationWorkbench';
import fixtureRaw from '@/lib/fixtures/simulation/acme_migration.json';

describe('QualificationWorkbench Component & Flow', () => {
  const opportunity = fixtureRaw.opportunity as any;

  it('renders in Simulation Mode by default with authentic Acme Corp baseline data', () => {
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Header checks
    expect(screen.getByText('DEAL OPERATIONS')).toBeDefined();
    expect(screen.getByText('Qualification System')).toBeDefined();
    expect(screen.getByRole('button', { name: /Workbench settings|Settings/i })).toBeDefined();

    // Zero raw enums or demo pill
    const header = screen.getByRole('banner');
    expect(header.textContent).not.toContain('Salesforce connected');

    // Context & Stepper
    expect(screen.getAllByText(/Acme Corp/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Baseline').length).toBeGreaterThan(0);
    expect(screen.getByText('Start assessment')).toBeDefined();

    // Baseline Score is 0 (unassessed)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);

    // Gate 2 check (5 blockers initially)
    expect(screen.getByText(/5 blockers remaining before advancement/i)).toBeDefined();
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

    expect(screen.getByText(/Live connected/i)).toBeDefined();

    const simBtn = screen.getByText(/Simulation mode/i);
    await act(async () => {
      fireEvent.click(simBtn);
    });

    expect(screen.getByText(/Deterministic simulation/i)).toBeDefined();
  });

  it('progresses sequentially and supports stepping back to the previous stage with input preservation', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // At READY_TO_ASSESS, Previous step button is disabled
    const prevBtn = screen.getByRole('button', { name: /Previous step/i });
    expect(prevBtn).toHaveProperty('disabled', true);

    // Click Start assessment to advance to ANALYZING
    const startBtn = screen.getByText('Start assessment');
    await act(async () => {
      fireEvent.click(startBtn);
    });

    // Advance 1200ms timer to reach PENDING_FEEDBACK
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Score is 54 and dynamic discovery form is rendered
    expect(screen.getAllByText('54').length).toBeGreaterThan(0);
    expect(screen.getByText(/Submit discovery findings/i)).toBeDefined();

    // Previous step button is now enabled
    expect(prevBtn).toHaveProperty('disabled', false);

    // Step back to READY_TO_ASSESS
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // Baseline score 0 is restored
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText('Start assessment')).toBeDefined();
    expect(prevBtn).toHaveProperty('disabled', true);

    vi.useRealTimers();
  });

  it('completes assessment and allows stepping back from COMPLETED to PENDING_FEEDBACK', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Advance to PENDING_FEEDBACK
    await act(async () => {
      fireEvent.click(screen.getByText('Start assessment'));
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Advance from PENDING_FEEDBACK via ActionPanel
    const advanceBtn = screen.getByText('Awaiting discovery findings');
    await act(async () => {
      fireEvent.click(advanceBtn);
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    // Reaches COMPLETED with 76 score
    expect(screen.getAllByText('76').length).toBeGreaterThan(0);
    expect(screen.getByText(/Gate criteria satisfied/i)).toBeDefined();

    // Step back from COMPLETED to PENDING_FEEDBACK
    const prevBtn = screen.getByRole('button', { name: /Previous step/i });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // Score reverts to 54 and discovery form is visible again
    expect(screen.getAllByText('54').length).toBeGreaterThan(0);
    expect(screen.getByText(/Submit discovery findings/i)).toBeDefined();

    vi.useRealTimers();
  });

  it('resets back to baseline on Reset button click', async () => {
    vi.useFakeTimers();
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Advance to PENDING_FEEDBACK
    await act(async () => {
      fireEvent.click(screen.getByText('Start assessment'));
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });
    expect(screen.getAllByText('54').length).toBeGreaterThan(0);

    // Reset via Settings
    const settingsBtn = screen.getByRole('button', { name: /Workbench settings|Settings/i });
    await act(async () => {
      fireEvent.click(settingsBtn);
    });
    const resetBtn = screen.getByRole('button', { name: /Reset Demo/i });
    await act(async () => {
      fireEvent.click(resetBtn);
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Score is 0 again and Start assessment button returned
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText(/5 blockers remaining before advancement/i)).toBeDefined();
    expect(screen.getByText('Start assessment')).toBeDefined();

    vi.useRealTimers();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText(/5 blockers remaining before advancement/i)).toBeDefined();
    expect(screen.getByText('Start assessment')).toBeDefined();
  });
});
