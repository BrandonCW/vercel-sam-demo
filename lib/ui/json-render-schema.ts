import { z } from 'zod';

export const FormFieldOptionSchema = z.object({
  label: z.string().min(1, 'Option label is required'),
  value: z.string().min(1, 'Option value is required'),
  description: z.string().optional(),
});
export type FormFieldOption = z.infer<typeof FormFieldOptionSchema>;

export const FormFieldTypeSchema = z.enum([
  'text',
  'textarea',
  'select',
  'radio',
  'checkbox_group',
]);
export type FormFieldType = z.infer<typeof FormFieldTypeSchema>;

export const DimensionTargetSchema = z.enum([
  'metrics',
  'economicBuyer',
  'decisionCriteria',
  'decisionProcess',
  'paperProcess',
  'identifyPain',
  'champion',
  'competition',
]);
export type DimensionTarget = z.infer<typeof DimensionTargetSchema>;

export const FormFieldSchema = z.object({
  id: z.string().min(1, 'Field id is required'),
  name: z.string().min(1, 'Field name is required'),
  label: z.string().min(1, 'Field label is required'),
  description: z.string().optional(),
  type: FormFieldTypeSchema,
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(FormFieldOptionSchema).optional(),
  dimensionTarget: DimensionTargetSchema,
  helpCallout: z.string().optional(),
});
export type FormField = z.infer<typeof FormFieldSchema>;

export const CalloutTypeSchema = z.enum(['info', 'warning', 'tip']);
export type CalloutType = z.infer<typeof CalloutTypeSchema>;

export const JsonRenderSectionSchema = z.object({
  id: z.string().min(1, 'Section id is required'),
  title: z.string().min(1, 'Section title is required'),
  description: z.string().optional(),
  calloutType: CalloutTypeSchema.optional(),
  calloutText: z.string().optional(),
  fields: z.array(FormFieldSchema).min(1, 'Section must contain at least one field'),
});
export type JsonRenderSection = z.infer<typeof JsonRenderSectionSchema>;

export const JsonRenderFormSchema = z.object({
  opportunityId: z.string().min(1, 'Opportunity ID is required'),
  title: z.string().min(1, 'Form title is required'),
  summary: z.string().min(1, 'Form summary is required'),
  sections: z.array(JsonRenderSectionSchema).min(1, 'Form must contain at least one section'),
});
export type JsonRenderForm = z.infer<typeof JsonRenderFormSchema>;
