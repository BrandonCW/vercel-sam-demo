import { describe, it, expect } from 'vitest';
import {
  JsonRenderFormSchema,
  JsonRenderSectionSchema,
  FormFieldSchema,
  FormFieldOptionSchema,
  DimensionTargetSchema,
  JsonRenderForm,
} from '@/lib/ui/json-render-schema';

describe('JSON Render Schema Validation', () => {
  it('validates a well-formed JsonRenderForm', () => {
    const validForm: JsonRenderForm = {
      opportunityId: 'opp_acme_001',
      title: 'Technical Qualification & Competitive Strategy',
      summary: 'System 1 flagged high Pain and Champion alignment, but Stage 2 exit is blocked.',
      sections: [
        {
          id: 'section_stage_gate',
          title: 'Stage Gate Blockers',
          description: 'Critical criteria to clear Gate 2',
          calloutType: 'warning',
          calloutText: 'Economic Buyer sign-off required.',
          fields: [
            {
              id: 'q_eb',
              name: 'economicBuyerAuthority',
              label: 'Who holds discretionary budget sign-off?',
              type: 'radio',
              required: true,
              dimensionTarget: 'economicBuyer',
              helpCallout: 'Direct executive sponsor engagement required',
              options: [
                { label: 'VP of E-Commerce', value: 'vp_ecom' },
                { label: 'Unconfirmed', value: 'unconfirmed' },
              ],
            },
            {
              id: 'q_build_metric',
              name: 'buildTimeBenchmark',
              label: 'Documented Current vs Target Build Performance',
              type: 'text',
              placeholder: 'Current: 45 min, Target: <5 min',
              required: true,
              dimensionTarget: 'metrics',
            },
          ],
        },
        {
          id: 'section_competitive',
          title: 'Competitive Counter-Positioning',
          calloutType: 'tip',
          calloutText: 'Position Next.js 14 App Router ISR against Netlify renewal discount.',
          fields: [
            {
              id: 'q_comp',
              name: 'netlifyCounter',
              label: 'Has customer experienced cache skew on Netlify?',
              type: 'select',
              required: true,
              dimensionTarget: 'competition',
              options: [
                { label: 'Yes - Frequent delays', value: 'yes' },
                { label: 'No', value: 'no' },
              ],
            },
            {
              id: 'q_notes',
              name: 'additionalDiscoveryNotes',
              label: 'Additional SA Discovery Observations',
              type: 'textarea',
              required: false,
              dimensionTarget: 'identifyPain',
            },
            {
              id: 'q_arch_features',
              name: 'requiredFeatures',
              label: 'Required Architectural Capabilities',
              type: 'checkbox_group',
              required: false,
              dimensionTarget: 'decisionCriteria',
              options: [
                { label: 'Turborepo Remote Caching', value: 'turborepo' },
                { label: 'Edge Middleware', value: 'middleware' },
              ],
            },
          ],
        },
      ],
    };

    const parsed = JsonRenderFormSchema.safeParse(validForm);
    expect(parsed.success).toBe(true);
  });

  it('rejects a form with missing required fields', () => {
    const invalidForm = {
      // missing opportunityId
      title: 'Missing Opp ID Form',
      summary: 'Summary text',
      sections: [],
    };

    const parsed = JsonRenderFormSchema.safeParse(invalidForm);
    expect(parsed.success).toBe(false);
  });

  it('rejects a form with empty sections array', () => {
    const invalidForm = {
      opportunityId: 'opp_123',
      title: 'No sections',
      summary: 'Summary text',
      sections: [],
    };

    const parsed = JsonRenderFormSchema.safeParse(invalidForm);
    expect(parsed.success).toBe(false);
  });

  it('rejects a section with empty fields array', () => {
    const invalidSection = {
      id: 'section_1',
      title: 'Empty Section',
      fields: [],
    };

    const parsed = JsonRenderSectionSchema.safeParse(invalidSection);
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const invalidField = {
      id: 'f1',
      name: 'invalidField',
      label: 'Invalid Type Field',
      type: 'unsupported_input_type',
      dimensionTarget: 'metrics',
    };

    const parsed = FormFieldSchema.safeParse(invalidField);
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid dimension targets', () => {
    const invalidField = {
      id: 'f1',
      name: 'testField',
      label: 'Invalid Dimension',
      type: 'text',
      dimensionTarget: 'invalid_dimension_name',
    };

    const parsed = FormFieldSchema.safeParse(invalidField);
    expect(parsed.success).toBe(false);
  });

  it('supports all 8 canonical MEDDPICC dimension targets', () => {
    const dimensions = [
      'metrics',
      'economicBuyer',
      'decisionCriteria',
      'decisionProcess',
      'paperProcess',
      'identifyPain',
      'champion',
      'competition',
    ];

    for (const dim of dimensions) {
      const parsed = DimensionTargetSchema.safeParse(dim);
      expect(parsed.success).toBe(true);
    }
  });

  it('supports all callout types: info, warning, tip', () => {
    for (const calloutType of ['info', 'warning', 'tip'] as const) {
      const section = {
        id: `sec_${calloutType}`,
        title: `Section ${calloutType}`,
        calloutType,
        calloutText: `Callout text for ${calloutType}`,
        fields: [
          {
            id: `f_${calloutType}`,
            name: `field_${calloutType}`,
            label: `Field label`,
            type: 'text' as const,
            dimensionTarget: 'metrics' as const,
          },
        ],
      };

      const parsed = JsonRenderSectionSchema.safeParse(section);
      expect(parsed.success).toBe(true);
    }
  });

  it('validates FormFieldOptionSchema with optional description', () => {
    const optWithDesc = {
      label: 'Option A',
      value: 'opt_a',
      description: 'Detailed option context',
    };
    expect(FormFieldOptionSchema.safeParse(optWithDesc).success).toBe(true);

    const optWithoutDesc = {
      label: 'Option B',
      value: 'opt_b',
    };
    expect(FormFieldOptionSchema.safeParse(optWithoutDesc).success).toBe(true);

    const emptyOpt = {
      label: '',
      value: '',
    };
    expect(FormFieldOptionSchema.safeParse(emptyOpt).success).toBe(false);
  });
});
