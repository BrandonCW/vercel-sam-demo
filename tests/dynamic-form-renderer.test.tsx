// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DynamicFormRenderer } from '@/components/workbench/DynamicFormRenderer';
import { JsonRenderForm } from '@/lib/ui/json-render-schema';

const mockForm: JsonRenderForm = {
  opportunityId: 'opp_acme_corp_001',
  title: 'Technical Qualification & Discovery Validation',
  summary: 'Validate critical Economic Buyer authority and Netlify counter-offer.',
  sections: [
    {
      id: 'section_stage_gate',
      title: 'Stage Gate Blockers',
      description: 'Address critical Stage Gate criteria.',
      calloutType: 'warning',
      calloutText: 'Stage 2 Gate Blocked: Economic Buyer sign-off required.',
      fields: [
        {
          id: 'q_eb_authority',
          name: 'economicBuyerSignoff',
          label: 'Has the VP of E-Commerce confirmed sole discretionary budget authority?',
          description: 'Determine sign-off thresholds.',
          type: 'radio',
          required: true,
          options: [
            { label: 'Confirmed sole authority up to $250k', value: 'confirmed_sole' },
            { label: 'Requires CFO joint approval', value: 'requires_cfo' },
          ],
          dimensionTarget: 'economicBuyer',
        },
        {
          id: 'q_notes_text',
          name: 'generalNotes',
          label: 'Additional discovery notes',
          type: 'text',
          required: false,
          placeholder: 'Enter notes here',
          dimensionTarget: 'metrics',
        },
      ],
    },
  ],
};

describe('DynamicFormRenderer Component Contract Seam', () => {
  it('renders section title, callout, and input controls accurately according to schema', () => {
    const handleSubmit = vi.fn();
    render(<DynamicFormRenderer form={mockForm} onSubmit={handleSubmit} isSubmitting={false} />);

    expect(screen.getByText('Stage Gate Blockers')).toBeTruthy();
    expect(screen.getByText(/Stage 2 Gate Blocked: Economic Buyer sign-off required/i)).toBeTruthy();
    expect(
      screen.getByText('Has the VP of E-Commerce confirmed sole discretionary budget authority?')
    ).toBeTruthy();
    expect(screen.getByText('Confirmed sole authority up to $250k')).toBeTruthy();
    expect(screen.getByText('Requires CFO joint approval')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter notes here')).toBeTruthy();
  });

  it('prevents premature submission and flags required field validation error', () => {
    const handleSubmit = vi.fn();
    render(<DynamicFormRenderer form={mockForm} onSubmit={handleSubmit} isSubmitting={false} />);

    const submitBtn = screen.getByRole('button', { name: /Submit Discovery Findings/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/is required/i)).toBeTruthy();
  });

  it('compiles expected { fieldId: value } payload upon valid submission', () => {
    const handleSubmit = vi.fn();
    render(<DynamicFormRenderer form={mockForm} onSubmit={handleSubmit} isSubmitting={false} />);

    // Select radio option
    const radioOption = screen.getByText('Confirmed sole authority up to $250k');
    fireEvent.click(radioOption);

    // Enter text input
    const textInput = screen.getByPlaceholderText('Enter notes here');
    fireEvent.change(textInput, { target: { value: 'Target LCP < 1.2s' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Submit Discovery Findings/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith({
      q_eb_authority: 'confirmed_sole',
      q_notes_text: 'Target LCP < 1.2s',
    });
  });
});
