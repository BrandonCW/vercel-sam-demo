import { z } from 'zod';
import {
  CalloutTypeSchema,
  DimensionTargetSchema,
  FormFieldTypeSchema,
  JsonRenderFormSchema,
  JsonRenderSectionSchema,
  type DimensionTarget,
  type FormField,
  type JsonRenderForm,
  type JsonRenderSection,
} from '@/lib/ui/json-render-schema';
import { System2ModelSchema, type System2ModelOption } from '@/lib/models';


export const QualificationGapSchema = z.object({
  dimension: DimensionTargetSchema,
  dimensionLabel: z.string(),
  score: z.number(),
  status: z.enum(['unaddressed', 'partial']),
  isStageGateBlocker: z.boolean(),
  riskLevel: z.enum(['critical', 'high', 'medium', 'low']),
  verifiedFact: z.string(),
  aeAssumption: z.string(),
  riskAnalysis: z.string(),
});
export type QualificationGap = z.infer<typeof QualificationGapSchema>;

export const CompetitiveCounterPointSchema = z.object({
  competitor: z.string(),
  threatLevel: z.enum(['low', 'medium', 'high']),
  competitorClaim: z.string(),
  vercelDifferentiator: z.string(),
  tacticalAngle: z.string(),
  trapQuestion: z.string(),
});
export type CompetitiveCounterPoint = z.infer<typeof CompetitiveCounterPointSchema>;

/** Per-dimension citations (verbatim note quotes) and gap callouts. Jev returns no text, so these come from System 2. */
export const DimensionFindingSchema = z.object({
  citations: z.array(z.string()),
  gaps: z.array(z.string()),
});
export type DimensionFinding = z.infer<typeof DimensionFindingSchema>;

export const DimensionFindingsSchema = z.object({
  metrics: DimensionFindingSchema,
  economicBuyer: DimensionFindingSchema,
  decisionCriteria: DimensionFindingSchema,
  decisionProcess: DimensionFindingSchema,
  paperProcess: DimensionFindingSchema,
  identifyPain: DimensionFindingSchema,
  champion: DimensionFindingSchema,
  competition: DimensionFindingSchema,
});

/*
 * Model-facing form schema. Structured output drops or garbles optional fields,
 * so every property is required: "not applicable" is null, and text fields carry
 * an empty options array. toSystem2AnalysisResult maps this onto the render schema
 * and rejects anything the renderer cannot show.
 */
const ModelFormOptionSchema = z.object({
  label: z.string().describe('Text shown to the SA for this choice.'),
  value: z.string().describe('Unique snake_case identifier for this choice within the field.'),
});

const ModelFormFieldSchema = z.object({
  id: z.string().describe('Unique snake_case field id within the form.'),
  name: z.string().describe('Same value as id.'),
  label: z.string().describe('The discovery question, phrased for the SA.'),
  description: z.string().nullable().describe('Extra context for the question, or null.'),
  type: FormFieldTypeSchema.describe('text/textarea for free answers; select/radio/checkbox_group for choices.'),
  placeholder: z.string().nullable().describe('Input placeholder for text/textarea, or null.'),
  required: z.boolean().describe('Whether the SA must answer before submitting.'),
  options: z
    .array(ModelFormOptionSchema)
    .describe('For select/radio/checkbox_group: 2 to 5 choices, each with its own label and value. For text/textarea: [].'),
  dimensionTarget: DimensionTargetSchema.describe('The MEDDPICC dimension this question resolves.'),
  helpCallout: z.string().nullable().describe('A short hint citing what the notes already say, or null.'),
});

const ModelFormSectionSchema = z.object({
  id: z.string().describe('Unique snake_case section id.'),
  title: z.string(),
  description: z.string().nullable().describe('One sentence on why this section matters, or null.'),
  calloutType: CalloutTypeSchema.nullable().describe('Callout style if calloutText is set, otherwise null.'),
  calloutText: z.string().nullable().describe('A highlighted note for the section, or null.'),
  fields: z.array(ModelFormFieldSchema).describe('At least one field.'),
});

const ModelFormSchema = z.object({
  title: z.string(),
  summary: z.string().describe('Two sentences on what the SA must validate and why.'),
  sections: z.array(ModelFormSectionSchema).describe('1 to 3 sections holding 3 to 5 questions in total.'),
});

/**
 * What the System 2 model must return. Code, not the model, turns this into status and next steps.
 * Property order is generation order: citations and the discovery form stream first, so the
 * workbench can show them while the rest is still being written.
 */
export const System2ModelOutputSchema = z.object({
  dimensionFindings: DimensionFindingsSchema,
  phase3Form: ModelFormSchema,
  fatalBlocker: z
    .string()
    .nullable()
    .describe('An unresolvable constraint that rules out Vercel (e.g. strict on-premise mandate), or null.'),
  phase1Gaps: z.array(QualificationGapSchema),
  phase2Competitive: z.array(CompetitiveCounterPointSchema),
  valueFocus: z.string().describe('Core technical or business value to focus on, a short phrase.'),
  primaryRisk: z.string().describe('Primary non-competitor risk to watch, a short phrase.'),
  nextMilestone: z.string().describe('The single next milestone action if the deal advances, one sentence.'),
  summary: z.string(),
});
export type System2ModelOutput = z.infer<typeof System2ModelOutputSchema>;

/** The persisted System 2 result: model output with the render-ready form. */
export const System2AnalysisResultSchema = System2ModelOutputSchema.extend({
  phase3Form: JsonRenderFormSchema,
  opportunityId: z.string(),
  modelUsed: System2ModelSchema,
});
export type System2AnalysisResult = z.infer<typeof System2AnalysisResultSchema>;

const CHOICE_TYPES = new Set<FormField['type']>(['select', 'radio', 'checkbox_group']);

function present<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

type ModelFormSection = System2ModelOutput['phase3Form']['sections'][number];
type ModelFormField = ModelFormSection['fields'][number];

/** One model form field as the renderer takes it. Throws on a choice field without options. */
function toRenderField(field: ModelFormField): FormField {
  const isChoice = CHOICE_TYPES.has(field.type);
  if (isChoice && field.options.length === 0) {
    throw new Error(`System 2 returned ${field.type} field "${field.id}" with no options`);
  }
  return {
    id: field.id,
    name: field.name,
    label: field.label,
    description: present(field.description),
    type: field.type,
    placeholder: present(field.placeholder),
    required: field.required,
    options: isChoice ? field.options : undefined,
    dimensionTarget: field.dimensionTarget,
    helpCallout: present(field.helpCallout),
  };
}

function toRenderSection(section: ModelFormSection): JsonRenderSection {
  return {
    id: section.id,
    title: section.title,
    description: present(section.description),
    calloutType: present(section.calloutType),
    calloutText: present(section.calloutText),
    fields: section.fields.map(toRenderField),
  };
}

/**
 * Validates raw model output and maps it onto the persisted System 2 result and
 * render form. Throws on anything the renderer cannot show; nothing is defaulted.
 */
export function toSystem2AnalysisResult(
  raw: unknown,
  meta: { opportunityId: string; model: System2ModelOption }
): System2AnalysisResult {
  const output = System2ModelOutputSchema.parse(raw);
  const sections = output.phase3Form.sections.map(toRenderSection);
  return System2AnalysisResultSchema.parse({
    ...output,
    phase3Form: JSON.parse(
      JSON.stringify(JsonRenderFormSchema.parse({ ...output.phase3Form, sections, opportunityId: meta.opportunityId }))
    ),
    opportunityId: meta.opportunityId,
    modelUsed: meta.model,
  });
}
