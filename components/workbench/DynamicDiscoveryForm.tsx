'use client';

import React, { useState } from 'react';
import { Search, Check, AlertTriangle, Lightbulb, Info, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JsonRenderForm, JsonRenderSection, FormField } from '@/lib/ui/json-render-schema';
import { TenSegmentBar } from './MeddpiccScorecard';

const TARGET_DIMENSION_DEFAULTS: Record<string, { label: string; score: number }> = {
  identifyPain: { label: 'Identify Pain', score: 9 },
  champion: { label: 'Champion', score: 7 },
  economicBuyer: { label: 'Economic Buyer', score: 3 },
  decisionCriteria: { label: 'Decision Criteria', score: 3 },
  decisionProcess: { label: 'Decision Process', score: 5 },
  metrics: { label: 'Metrics', score: 6 },
  competition: { label: 'Competition', score: 7 },
  paperProcess: { label: 'Paper Process', score: 4 },
};

export interface DynamicDiscoveryFormProps {
  dynamicForm?: JsonRenderForm | null;
  form?: JsonRenderForm | null;
  onSubmit: (
    responses: Record<string, string | string[]>,
    notesDelta?: string
  ) => Promise<void> | void;
  isSubmitting?: boolean;
  isLocked?: boolean;
  initialValues?: Record<string, string | string[]>;
  readOnly?: boolean;
  submitButtonText?: string;
  dimensions?: Record<string, any>;
}

export function DynamicDiscoveryForm({
  dynamicForm,
  form,
  onSubmit,
  isSubmitting = false,
  isLocked = false,
  initialValues = {},
  readOnly = false,
  submitButtonText = 'Submit Discovery Findings',
  dimensions,
}: DynamicDiscoveryFormProps) {
  const activeForm = form ?? dynamicForm;

  const [formData, setFormData] = useState<Record<string, string | string[]>>(initialValues);
  const [manualNotes, setManualNotes] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fallback simulation state
  const [ebAnswer, setEbAnswer] = useState('Meeting pending');
  const [criteria, setCriteria] = useState('Build speed <5m + Turborepo caching + ISR');

  const handleTextChange = (fieldId: string, val: string) => {
    if (readOnly) return;
    setFormData((prev) => ({ ...prev, [fieldId]: val }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleCheckboxToggle = (fieldId: string, optionValue: string) => {
    if (readOnly) return;
    setFormData((prev) => {
      const current = (prev[fieldId] as string[]) || [];
      const updated = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [fieldId]: updated };
    });
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    if (!activeForm || !activeForm.sections) return true;
    const newErrors: Record<string, string> = {};

    for (const section of activeForm.sections) {
      for (const field of section.fields) {
        if (!field.required) continue;
        const val = formData[field.id];
        if (
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0)
        ) {
          newErrors[field.id] =
            field.type === 'checkbox_group'
              ? `${field.label} is required. Please select at least one option.`
              : `${field.label} is required.`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || isSubmitting || isLocked) return;

    if (!validate()) return;

    if (activeForm && activeForm.sections && activeForm.sections.length > 0) {
      if (manualNotes) {
        await onSubmit(formData, manualNotes);
      } else {
        await onSubmit(formData);
      }
    } else {
      // Fallback submission payload
      const fallbackPayload = {
        eb: ebAnswer,
        technicalCriteria: criteria,
      };
      if (manualNotes) {
        await onSubmit(fallbackPayload, manualNotes);
      } else {
        await onSubmit(fallbackPayload);
      }
    }
  };

  const renderCalloutBanner = (section: JsonRenderSection) => {
    if (!section.calloutText) return null;
    const type = section.calloutType || 'info';

    if (type === 'warning') {
      return (
        <div className="mb-3.5 flex items-start gap-2.5 rounded-md border border-[#E2E0D8] bg-[#F1F0EC] p-3 text-xs text-[#111215]">
          <AlertTriangle className="size-4 shrink-0 text-[#D97706] mt-0.5" />
          <div className="leading-relaxed font-medium">{section.calloutText}</div>
        </div>
      );
    }

    if (type === 'tip') {
      return (
        <div className="mb-3.5 flex items-start gap-2.5 rounded-md border border-[#E2E0D8] bg-[#F1F0EC] p-3 text-xs text-[#111215]">
          <Lightbulb className="size-4 shrink-0 text-[#059669] mt-0.5" />
          <div className="leading-relaxed font-medium">{section.calloutText}</div>
        </div>
      );
    }

    return (
      <div className="mb-3.5 flex items-start gap-2.5 rounded-md border border-[#E2E0D8] bg-[#F1F0EC] p-3 text-xs text-[#111215]">
        <Info className="size-4 shrink-0 text-[#0F52BA] mt-0.5" />
        <div className="leading-relaxed font-medium">{section.calloutText}</div>
      </div>
    );
  };

  const renderField = (field: FormField) => {
    const error = errors[field.id];
    const value = formData[field.id];

    // Target dimension lookup for compact 10-segment score bar + score chip
    const dimKey = field.dimensionTarget;
    const targetDim = dimKey
      ? (dimensions && dimensions[dimKey]) || TARGET_DIMENSION_DEFAULTS[dimKey] || {
          label: dimKey,
          score: 0,
        }
      : null;

    return (
      <div key={field.id} className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <label htmlFor={field.id} className="block text-xs font-semibold text-[#111215]">
            {field.label}
            {field.required && <span className="text-[#DC2626] ml-1">*</span>}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-wide text-[#787C87] bg-[#F1F0EC] px-1.5 py-0.5 rounded border border-[#E2E0D8]">
              {field.dimensionTarget}
            </span>
            {targetDim && (
              <div
                className="flex items-center gap-1.5 rounded border border-[#E2E0D8] bg-[#F1F0EC] px-2 py-0.5"
                aria-label={`${targetDim.label}: ${targetDim.score}/10`}
              >
                <TenSegmentBar score={targetDim.score} compact={true} />
                <span className="font-mono text-[10px] font-semibold text-[#111215] tabular-nums">
                  {targetDim.label}: {targetDim.score}/10
                </span>
              </div>
            )}
          </div>
        </div>

        {field.description && (
          <p className="text-[11px] text-[#787C87] leading-relaxed">{field.description}</p>
        )}

        {/* 1. Text Field */}
        {field.type === 'text' && (
          <input
            id={field.id}
            name={field.name}
            type="text"
            disabled={readOnly}
            value={(value as string) || ''}
            onChange={(e) => handleTextChange(field.id, e.target.value)}
            placeholder={field.placeholder || undefined}
            aria-invalid={Boolean(error)}
            aria-required={field.required}
            className={`w-full rounded-md border ${
              error ? 'border-[#DC2626] focus:ring-[#DC2626]' : 'border-[#E2E0D8] focus:ring-[#111215]'
            } bg-[#F1F0EC]/50 px-3 py-2 text-xs text-[#111215] outline-none focus:ring-1 focus:bg-white disabled:opacity-50`}
          />
        )}

        {/* 2. Textarea Field */}
        {field.type === 'textarea' && (
          <textarea
            id={field.id}
            name={field.name}
            rows={3}
            disabled={readOnly}
            value={(value as string) || ''}
            onChange={(e) => handleTextChange(field.id, e.target.value)}
            placeholder={field.placeholder || undefined}
            aria-invalid={Boolean(error)}
            aria-required={field.required}
            className={`w-full rounded-md border ${
              error ? 'border-[#DC2626] focus:ring-[#DC2626]' : 'border-[#E2E0D8] focus:ring-[#111215]'
            } bg-[#F1F0EC]/50 px-3 py-2 text-xs text-[#111215] outline-none focus:ring-1 focus:bg-white disabled:opacity-50 resize-y`}
          />
        )}

        {/* 3. Select Field */}
        {field.type === 'select' && (
          <select
            id={field.id}
            name={field.name}
            disabled={readOnly}
            value={(value as string) || ''}
            onChange={(e) => handleTextChange(field.id, e.target.value)}
            aria-invalid={Boolean(error)}
            aria-required={field.required}
            className={`w-full rounded-md border ${
              error ? 'border-[#DC2626] focus:ring-[#DC2626]' : 'border-[#E2E0D8] focus:ring-[#111215]'
            } bg-[#F1F0EC]/50 px-3 py-2 text-xs text-[#111215] outline-none focus:ring-1 focus:bg-white cursor-pointer disabled:opacity-50`}
          >
            <option value="" disabled>
              Select an option...
            </option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* 4. Radio Group Field */}
        {field.type === 'radio' && (
          <div className="space-y-1.5 pt-0.5" role="radiogroup" aria-required={field.required}>
            {field.options?.map((opt) => {
              const checked = value === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition ${
                    checked
                      ? 'border-[#111215] bg-[#F1F0EC] text-[#111215]'
                      : 'border-[#E2E0D8] bg-[#FFFFFF] hover:border-[#787C87] text-[#52545D]'
                  } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => handleTextChange(field.id, opt.value)}
                    className="mt-0.5 accent-[#0F52BA]"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-[#111215]">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[11px] text-[#787C87] mt-0.5 leading-relaxed">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* 5. Checkbox Group Field */}
        {field.type === 'checkbox_group' && (
          <div className="space-y-1.5 pt-0.5">
            {field.options?.map((opt) => {
              const selectedList = (value as string[]) || [];
              const checked = selectedList.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition ${
                    checked
                      ? 'border-[#111215] bg-[#F1F0EC] text-[#111215]'
                      : 'border-[#E2E0D8] bg-[#FFFFFF] hover:border-[#787C87] text-[#52545D]'
                  } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => handleCheckboxToggle(field.id, opt.value)}
                    className="mt-0.5 rounded accent-[#0F52BA]"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-[#111215]">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[11px] text-[#787C87] mt-0.5 leading-relaxed">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {field.helpCallout && (
          <div className="flex items-start gap-1.5 mt-1 text-[11px] text-[#787C87] bg-[#F1F0EC] px-2.5 py-1.5 rounded-md border border-[#E2E0D8]">
            <HelpCircle className="size-3.5 text-[#52545D] shrink-0 mt-0.5" />
            <span>{field.helpCallout}</span>
          </div>
        )}

        {error && <p className="text-[11px] text-[#DC2626] font-medium mt-1">{error}</p>}
      </div>
    );
  };

  return (
    <section className="rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] shadow-xs">
      <div className="border-b border-[#E2E0D8] px-5 py-4">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-[#0F52BA]" aria-hidden="true" />
          <h3 className="font-semibold text-sm text-[#111215]">
            {activeForm?.title || 'Targeted discovery findings'}
          </h3>
        </div>
        <p className="mt-1 text-xs text-[#787C87]">
          {activeForm?.summary || 'Close the qualification blind spots identified in baseline scoring.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-5">
        {activeForm && activeForm.sections && activeForm.sections.length > 0 ? (
          activeForm.sections.map((section) => (
            <div key={section.id} className="space-y-3.5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.05em] text-[#787C87]">
                  {section.title}
                </h4>
                {section.description && (
                  <p className="text-xs text-[#787C87] leading-relaxed mt-0.5">
                    {section.description}
                  </p>
                )}
              </div>

              {renderCalloutBanner(section)}

              <div className="space-y-3.5 pt-0.5">{section.fields.map(renderField)}</div>
            </div>
          ))
        ) : (
          <>
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-[#111215] mb-1">
                Did Jane Doe (VP Engineering) formally confirm sponsorship?
              </legend>
              {[
                'Confirmed sponsorship if build times drop <5 min',
                'Meeting pending',
                'No contact yet',
              ].map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-[#E2E0D8] px-4 py-3 text-sm text-[#52545D] transition has-[:checked]:border-[#111215] has-[:checked]:bg-[#F1F0EC]"
                >
                  <input
                    type="radio"
                    name="eb"
                    value={option}
                    checked={ebAnswer === option}
                    disabled={readOnly}
                    onChange={(e) => setEbAnswer(e.target.value)}
                    className="accent-[#0F52BA]"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>

            <label className="flex flex-col gap-2 text-sm font-semibold text-[#111215]">
              <span>Confirmed technical decision criteria:</span>
              <select
                value={criteria}
                disabled={readOnly}
                onChange={(e) => setCriteria(e.target.value)}
                className="rounded-md border border-[#E2E0D8] bg-[#F1F0EC]/50 px-3 py-2.5 text-sm font-normal text-[#111215] outline-none focus:ring-1 focus:ring-[#111215] cursor-pointer disabled:opacity-50"
              >
                <option value="Build speed <5m + Turborepo caching + ISR">
                  Build speed &lt;5m + Turborepo caching + ISR
                </option>
                <option value="Hosting cost parity only">Hosting cost parity only</option>
                <option value="Undefined">Undefined</option>
              </select>
            </label>
          </>
        )}

        {!readOnly && (
          <div className="space-y-2 pt-2 border-t border-[#E2E0D8]">
            <label
              htmlFor="sa_manual_notes"
              className="block text-xs font-semibold text-[#111215]"
            >
              Additional SA Notes &amp; Observations <span className="text-[#787C87] font-normal">(Optional)</span>
            </label>
            <textarea
              id="sa_manual_notes"
              aria-label="Additional SA Notes & Observations"
              rows={3}
              placeholder="Document any additional customer architecture context or meeting observations..."
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              className="w-full rounded-md border border-[#E2E0D8] bg-[#F1F0EC]/50 px-3 py-2 text-xs text-[#111215] outline-none focus:ring-1 focus:ring-[#111215] focus:bg-white"
            />
          </div>
        )}

        {!readOnly && (
          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting || isLocked}
              aria-label="Submit Discovery Findings"
              className="w-full bg-[#0F52BA] text-white hover:bg-[#0C4196] sm:w-fit cursor-pointer disabled:opacity-50 text-xs font-semibold py-2 h-auto"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                  <span>Executing Delta Re-scoring...</span>
                </>
              ) : (
                <>
                  <span>{submitButtonText}</span>
                  <Check className="size-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
