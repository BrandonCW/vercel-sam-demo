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
    expect(screen.getByText('⚡ Simulation mode')).toBeDefined();
    expect(screen.getByText('🌐 Live AI mode')).toBeDefined();
    expect(screen.getByText('Salesforce connected')).toBeDefined();

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

    const liveBtn = screen.getByText('🌐 Live AI mode');
    await act(async () => {
      fireEvent.click(liveBtn);
    });

    expect(screen.getByText(/Live connected/i)).toBeDefined();
    expect(screen.getByText('Live Mode')).toBeDefined();
    expect(screen.getByText('AI Gateway & Salesforce')).toBeDefined();
    // In Live Mode, the simulation JumpToState buttons (1, 2, 3, 4, 5) should not be present
    expect(screen.queryByRole('button', { name: /Jump to 1/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Jump to 3/i })).toBeNull();

    const simBtn = screen.getByText('⚡ Simulation mode');
    await act(async () => {
      fireEvent.click(simBtn);
    });

    expect(screen.getByText(/Deterministic simulation/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Jump to 1/i })).toBeDefined();
  });

  it('jumps directly to State 3 (Discovery paused) and displays dynamic form', async () => {
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Click "3" in Jump to state
    const jumpBtn3 = screen.getByRole('button', { name: /Jump to 3/i });
    await act(async () => {
      fireEvent.click(jumpBtn3);
    });

    // Expect score 54
    expect(screen.getAllByText('54').length).toBeGreaterThan(0);

    // Expect $0 compute banner
    expect(screen.getByText(/\$0 compute/i)).toBeDefined();
    expect(screen.getByText(/Submit discovery findings/i)).toBeDefined();
  });

  it('jumps directly to State 5 (Completed) and displays 76 score with Gate 2 Passed and Next Steps', async () => {
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Click "5" in Jump to state
    const jumpBtn5 = screen.getByRole('button', { name: /Jump to 5/i });
    await act(async () => {
      fireEvent.click(jumpBtn5);
    });

    // Expect score 76
    expect(screen.getAllByText('76').length).toBeGreaterThan(0);
    expect(screen.getByText(/Gate criteria satisfied/i)).toBeDefined();
    expect(screen.getByText(/Stage Gate Passed/i)).toBeDefined();

    // Suggested Next Steps visible
    expect(screen.getAllByText(/Advance to Stage 3/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Copy to clipboard')).toBeDefined();
  });

  it('resets back to baseline on Reset button click', async () => {
    render(<QualificationWorkbench initialOpportunity={opportunity} />);

    // Jump to 5 first
    const jumpBtn5 = screen.getByRole('button', { name: /Jump to 5/i });
    await act(async () => {
      fireEvent.click(jumpBtn5);
    });
    expect(screen.getAllByText('76').length).toBeGreaterThan(0);

    // Reset
    const resetBtn = screen.getByRole('button', { name: /Reset Demo/i });
    await act(async () => {
      fireEvent.click(resetBtn);
    });

    // Score is 0 again and Start assessment button returned
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText(/5 blockers remaining before advancement/i)).toBeDefined();
    expect(screen.getByText('Start assessment')).toBeDefined();
  });
});
