import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { System2ModelOutputSchema, toSystem2AnalysisResult, type System2ModelOutput } from '@/lib/agents/system2';
import { JsonRenderFormSchema } from '@/lib/ui/json-render-schema';

/** Every property the model sees must be required: optional/default fields are what it silently omits. */
function optionalPaths(schema: z.ZodTypeAny, path = '$'): string[] {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) return [path];
  if (schema instanceof z.ZodNullable) return optionalPaths(schema.unwrap(), path);
  if (schema instanceof z.ZodArray) return optionalPaths(schema.element, `${path}[]`);
  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape as Record<string, z.ZodTypeAny>).flatMap(([k, v]) => optionalPaths(v, `${path}.${k}`));
  }
  return [];
}

const finding = { citations: [], gaps: [] };
function output(fields: System2ModelOutput['phase3Form']['sections'][number]['fields']): System2ModelOutput {
  return {
    phase3Form: {
      title: 'Discovery',
      summary: 'Confirm the buyer.',
      sections: [{ id: 's1', title: 'Blockers', description: null, calloutType: null, calloutText: null, fields }],
    },
    dimensionFindings: Object.fromEntries(
      ['metrics', 'economicBuyer', 'decisionCriteria', 'decisionProcess', 'paperProcess', 'identifyPain', 'champion', 'competition'].map((k) => [k, finding])
    ) as unknown as System2ModelOutput['dimensionFindings'],
    fatalBlocker: null,
    valueFocus: 'Build speed',
    primaryRisk: 'No budget',
    nextMilestone: 'Meet the CFO.',
  };
}
const field = { description: null, placeholder: null, helpCallout: null, required: true, dimensionTarget: 'economicBuyer' as const };

describe('System 2 structured output', () => {
  it('asks the model for no optional or defaulted fields', () => {
    expect(optionalPaths(System2ModelOutputSchema)).toEqual([]);
  });

  it('does not ask the model for the opportunityId it cannot know', () => {
    expect(Object.keys(System2ModelOutputSchema.shape.phase3Form.shape)).not.toContain('opportunityId');
  });

  it('maps model output to a valid render form: nulls dropped, options only on choice fields', () => {
    const result = toSystem2AnalysisResult(
      output([
        { ...field, id: 'eb', name: 'eb', label: 'Who signs?', type: 'text', options: [] },
        {
          ...field,
          id: 'plan',
          name: 'plan',
          label: 'Plan?',
          type: 'select',
          helpCallout: 'Ask Priya.',
          options: [
            { label: 'Scheduled', value: 'scheduled' },
            { label: 'None', value: 'none' },
          ],
        },
      ]),
      { opportunityId: 'opp_acme_corp_001', model: 'google/gemini-3.8-flash' }
    );
    expect(JsonRenderFormSchema.parse(result.phase3Form)).toEqual(result.phase3Form);
    const [text, select] = result.phase3Form.sections[0].fields;
    expect(text).not.toHaveProperty('options');
    expect(text).not.toHaveProperty('description');
    expect(select.options).toHaveLength(2);
    expect(select.helpCallout).toBe('Ask Priya.');
    expect(result.phase3Form.sections[0]).not.toHaveProperty('calloutType');
    expect(result).toMatchObject({ opportunityId: 'opp_acme_corp_001', modelUsed: 'google/gemini-3.8-flash' });
  });

  it('coerces choice fields with empty or whitespace-only options to text with options: undefined without throwing', () => {
    const resultEmpty = toSystem2AnalysisResult(
      output([{ ...field, id: 'x', name: 'x', label: 'Pick', type: 'radio', options: [] }]),
      {
        opportunityId: 'opp_x',
        model: 'google/gemini-3.8-flash',
      }
    );
    const coercedEmpty = resultEmpty.phase3Form.sections[0].fields[0];
    expect(coercedEmpty.type).toBe('text');
    expect(coercedEmpty).not.toHaveProperty('options');

    const resultWhitespace = toSystem2AnalysisResult(
      output([{ ...field, id: 'y', name: 'y', label: 'Pick', type: 'select', options: [{ label: '   ', value: '   ' }] }]),
      {
        opportunityId: 'opp_y',
        model: 'google/gemini-3.8-flash',
      }
    );
    const coercedWhitespace = resultWhitespace.phase3Form.sections[0].fields[0];
    expect(coercedWhitespace.type).toBe('text');
    expect(coercedWhitespace).not.toHaveProperty('options');
  });

  it('fails loudly on an option without a value', () => {
    expect(() =>
      toSystem2AnalysisResult(
        output([{ ...field, id: 'x', name: 'x', label: 'Pick', type: 'radio', options: [{ label: 'A', value: 'a' }, { label: 'B' } as any] }]),
        { opportunityId: 'opp_x', model: 'google/gemini-3.8-flash' }
      )
    ).toThrow();
  });
});
