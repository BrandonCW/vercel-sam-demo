// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DynamicFormRenderer } from '@/components/workbench/DynamicFormRenderer';
import { JsonRenderForm } from '@/lib/ui/json-render-schema';

const mockComprehensiveForm: JsonRenderForm = {
  opportunityId: 'opp_acme_corp_001',
  title: 'Technical Qualification & Discovery Validation',
  summary: 'Validate critical Economic Buyer authority, Netlify counter-offer, and architecture metrics.',
  sections: [
    {
      id: 'section_stage_gate',
      title: 'Stage Gate Blockers',
      description: 'Address critical Stage Gate criteria required to unlock Stage 3.',
      calloutType: 'warning',
      calloutText: 'Stage 2 Gate Blocked: Economic Buyer sign-off required.',
      fields: [
        {
          id: 'q_eb_authority',
          name: 'economicBuyerSignoff',
          label: 'Has the VP of E-Commerce confirmed sole discretionary budget authority?',
          description: 'Determine sign-off thresholds and committee requirements.',
          type: 'radio',
          required: true,
          helpCallout: 'Stage Gate requirement: Verified budget authority is required.',
          options: [
            { label: 'Confirmed sole authority up to $250k', value: 'confirmed_sole', description: 'Unilateral signoff' },
            { label: 'Requires CFO joint approval', value: 'requires_cfo', description: 'Dual signoff' },
          ],
          dimensionTarget: 'economicBuyer',
        },
        {
          id: 'q_pain_dollar',
          name: 'painQuantification',
          label: 'Quantified revenue impact of deploy bottlenecks',
          type: 'textarea',
          required: true,
          placeholder: 'Enter dollar impact...',
          dimensionTarget: 'identifyPain',
        },
      ],
    },
    {
      id: 'section_competitive',
      title: 'Competitive Strategy (Netlify)',
      description: 'Expose incumbent discounting and cache skew limitations.',
      calloutType: 'tip',
      calloutText: 'Counter-positioning: Highlight App Router streaming and ISR cache invalidation.',
      fields: [
        {
          id: 'q_comp_perception',
          name: 'competitorPerception',
          label: 'Customer perception of Netlify renewal discount',
          type: 'select',
          required: true,
          options: [
            { label: 'Confirmed Pain: Seeking to switch to Vercel', value: 'confirmed_switch' },
            { label: 'Evaluating 30% discount vs Vercel DX', value: 'evaluating_discount' },
          ],
          dimensionTarget: 'competition',
        },
      ],
    },
    {
      id: 'section_architecture',
      title: 'Architecture & Metrics Validation',
      calloutType: 'info',
      calloutText: 'Lock in technical decision criteria and quantitative success metrics.',
      fields: [
        {
          id: 'q_metrics_target',
          name: 'targetMetrics',
          label: 'Target Core Web Vitals & Build Time',
          type: 'text',
          required: false,
          placeholder: 'e.g. LCP < 1.5s',
          dimensionTarget: 'metrics',
        },
        {
          id: 'q_arch_features',
          name: 'architecturalRequirements',
          label: 'Mandatory Architectural Capabilities',
          type: 'checkbox_group',
          required: true,
          options: [
            { label: 'App Router & RSC', value: 'app_router' },
            { label: 'Turborepo Remote Caching', value: 'turborepo' },
            { label: 'Edge Middleware', value: 'edge_middleware' },
          ],
          dimensionTarget: 'decisionCriteria',
        },
      ],
    },
  ],
};

describe('DynamicFormRenderer Component Contract Seam (tests/dynamic-form-renderer.test.tsx)', () => {
  describe('1. Input Generation & Layout Rendering', () => {
    it('renders all sections, callout banners, and schema fields with labels and badges', () => {
      const handleSubmit = vi.fn();
      render(<DynamicFormRenderer form={mockComprehensiveForm} onSubmit={handleSubmit} />);

      // Form Header
      expect(screen.getByText('Technical Qualification & Discovery Validation')).toBeTruthy();
      expect(screen.getByText(/Validate critical Economic Buyer authority/i)).toBeTruthy();

      // Section Titles
      expect(screen.getByText('Stage Gate Blockers')).toBeTruthy();
      expect(screen.getByText('Competitive Strategy (Netlify)')).toBeTruthy();
      expect(screen.getByText('Architecture & Metrics Validation')).toBeTruthy();

      // Callout banners
      expect(screen.getByText(/Stage 2 Gate Blocked: Economic Buyer sign-off required/i)).toBeTruthy();
      expect(screen.getByText(/Counter-positioning: Highlight App Router streaming/i)).toBeTruthy();
      expect(screen.getByText(/Lock in technical decision criteria/i)).toBeTruthy();

      // Help Callout
      expect(screen.getByText(/Stage Gate requirement: Verified budget authority is required/i)).toBeTruthy();

      // Dimension target badges
      expect(screen.getByText('economicBuyer')).toBeTruthy();
      expect(screen.getByText('identifyPain')).toBeTruthy();
      expect(screen.getByText('competition')).toBeTruthy();
      expect(screen.getByText('metrics')).toBeTruthy();
      expect(screen.getByText('decisionCriteria')).toBeTruthy();

      // Radio input options & descriptions
      expect(screen.getByText('Confirmed sole authority up to $250k')).toBeTruthy();
      expect(screen.getByText('Unilateral signoff')).toBeTruthy();
      expect(screen.getByText('Requires CFO joint approval')).toBeTruthy();

      // Textarea input
      expect(screen.getByPlaceholderText('Enter dollar impact...')).toBeTruthy();

      // Select input
      expect(screen.getByText('Confirmed Pain: Seeking to switch to Vercel')).toBeTruthy();

      // Text input
      expect(screen.getByPlaceholderText('e.g. LCP < 1.5s')).toBeTruthy();

      // Checkbox group options
      expect(screen.getByText('App Router & RSC')).toBeTruthy();
      expect(screen.getByText('Turborepo Remote Caching')).toBeTruthy();
      expect(screen.getByText('Edge Middleware')).toBeTruthy();

      // Optional manual SA notes field
      expect(screen.getByLabelText(/Additional SA Notes & Observations/i)).toBeTruthy();
    });
  });

  describe('2. Field Constraints & Validation Enforcement', () => {
    it('blocks submission and surfaces validation errors for all empty required fields', () => {
      const handleSubmit = vi.fn();
      render(<DynamicFormRenderer form={mockComprehensiveForm} onSubmit={handleSubmit} />);

      const submitBtn = screen.getByRole('button', { name: /Submit Discovery Findings/i });
      fireEvent.click(submitBtn);

      // Submission should be blocked
      expect(handleSubmit).not.toHaveBeenCalled();

      // Radio required error
      expect(
        screen.getByText(/Has the VP of E-Commerce confirmed sole discretionary budget authority\? is required\./i)
      ).toBeTruthy();

      // Textarea required error
      expect(
        screen.getByText(/Quantified revenue impact of deploy bottlenecks is required\./i)
      ).toBeTruthy();

      // Select required error
      expect(
        screen.getByText(/Customer perception of Netlify renewal discount is required\./i)
      ).toBeTruthy();

      // Checkbox group required error
      expect(
        screen.getByText(/Mandatory Architectural Capabilities is required\. Please select at least one option\./i)
      ).toBeTruthy();
    });

    it('clears error messages dynamically when violating fields receive valid input', () => {
      const handleSubmit = vi.fn();
      render(<DynamicFormRenderer form={mockComprehensiveForm} onSubmit={handleSubmit} />);

      // Trigger errors
      const submitBtn = screen.getByRole('button', { name: /Submit Discovery Findings/i });
      fireEvent.click(submitBtn);
      expect(screen.getByText(/Quantified revenue impact of deploy bottlenecks is required\./i)).toBeTruthy();

      // Fill textarea
      const textarea = screen.getByPlaceholderText('Enter dollar impact...');
      fireEvent.change(textarea, { target: { value: '$120k lost annually in developer downtime' } });

      // Error should be immediately cleared
      expect(screen.queryByText(/Quantified revenue impact of deploy bottlenecks is required\./i)).toBeNull();

      // Select checkbox option
      expect(
        screen.getByText(/Mandatory Architectural Capabilities is required\. Please select at least one option\./i)
      ).toBeTruthy();
      const checkbox = screen.getByLabelText(/App Router & RSC/i);
      fireEvent.click(checkbox);

      // Checkbox error cleared
      expect(
        screen.queryByText(/Mandatory Architectural Capabilities is required\. Please select at least one option\./i)
      ).toBeNull();
    });
  });

  describe('3. Payload Packaging & Submission', () => {
    it('packages all input types into expected dictionary and delivers manual notes delta', async () => {
      const handleSubmit = vi.fn();
      render(<DynamicFormRenderer form={mockComprehensiveForm} onSubmit={handleSubmit} />);

      // 1. Select Radio option
      const radioOption = screen.getByText('Confirmed sole authority up to $250k');
      fireEvent.click(radioOption);

      // 2. Fill Textarea
      const textarea = screen.getByPlaceholderText('Enter dollar impact...');
      fireEvent.change(textarea, { target: { value: '$150k idle developer cost per quarter.' } });

      // 3. Select Dropdown option
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'confirmed_switch' } });

      // 4. Fill optional Text input
      const textInput = screen.getByPlaceholderText('e.g. LCP < 1.5s');
      fireEvent.change(textInput, { target: { value: 'LCP < 1.2s on mobile' } });

      // 5. Select Checkbox options (multiple)
      const cb1 = screen.getByLabelText(/App Router & RSC/i);
      const cb2 = screen.getByLabelText(/Turborepo Remote Caching/i);
      fireEvent.click(cb1);
      fireEvent.click(cb2);

      // 6. Enter Manual SA Notes
      const notesInput = screen.getByLabelText(/Additional SA Notes & Observations/i);
      fireEvent.change(notesInput, {
        target: { value: 'Meeting with Head of Platform was highly productive; requested POC next Tuesday.' },
      });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Submit Discovery Findings/i });
      fireEvent.click(submitBtn);

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit).toHaveBeenCalledWith(
        {
          q_eb_authority: 'confirmed_sole',
          q_pain_dollar: '$150k idle developer cost per quarter.',
          q_comp_perception: 'confirmed_switch',
          q_metrics_target: 'LCP < 1.2s on mobile',
          q_arch_features: ['app_router', 'turborepo'],
        },
        'Meeting with Head of Platform was highly productive; requested POC next Tuesday.'
      );
    });

    it('submits without notesDelta when manual SA observations are not provided', async () => {
      const handleSubmit = vi.fn();
      render(<DynamicFormRenderer form={mockComprehensiveForm} onSubmit={handleSubmit} />);

      // Radio
      fireEvent.click(screen.getByText('Confirmed sole authority up to $250k'));
      // Textarea
      fireEvent.change(screen.getByPlaceholderText('Enter dollar impact...'), {
        target: { value: 'Critical queue delays' },
      });
      // Select
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'confirmed_switch' } });
      // Checkbox
      fireEvent.click(screen.getByLabelText(/Edge Middleware/i));

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Submit Discovery Findings/i });
      fireEvent.click(submitBtn);

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit).toHaveBeenCalledWith({
        q_eb_authority: 'confirmed_sole',
        q_pain_dollar: 'Critical queue delays',
        q_comp_perception: 'confirmed_switch',
        q_arch_features: ['edge_middleware'],
      });
    });
  });

  describe('4. Component State Modes (readOnly & isSubmitting)', () => {
    it('disables input controls and hides submit button in readOnly mode', () => {
      const handleSubmit = vi.fn();
      render(
        <DynamicFormRenderer
          form={mockComprehensiveForm}
          onSubmit={handleSubmit}
          readOnly={true}
          initialValues={{
            q_eb_authority: 'confirmed_sole',
            q_pain_dollar: 'Recorded discovery pain',
          }}
        />
      );

      // Inputs should be disabled
      const textarea = screen.getByPlaceholderText('Enter dollar impact...');
      expect(textarea.getAttribute('disabled')).not.toBeNull();

      // Submit button should not be rendered
      expect(screen.queryByRole('button', { name: /Submit Discovery Findings/i })).toBeNull();

      // Manual notes should not be rendered
      expect(screen.queryByLabelText(/Additional SA Notes & Observations/i)).toBeNull();
    });

    it('disables submit button and shows loading spinner when isSubmitting is true', () => {
      const handleSubmit = vi.fn();
      render(
        <DynamicFormRenderer
          form={mockComprehensiveForm}
          onSubmit={handleSubmit}
          isSubmitting={true}
        />
      );

      const submitBtn = screen.getByRole('button');
      expect(submitBtn.getAttribute('disabled')).not.toBeNull();
      expect(screen.getByText('Executing Delta Re-scoring...')).toBeTruthy();
    });
  });
});
