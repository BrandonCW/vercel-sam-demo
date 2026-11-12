'use client';

import React, { useState, useEffect } from 'react';
import { Info, ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JsonRenderForm, JsonRenderSection, FormField } from '@/lib/ui/json-render-schema';
import { TenSegmentBar } from './MeddpiccScorecard';

const TARGET_DIMENSION_DEFAULTS: Record<string, { code: string; label: string; score: number }> = {
  identifyPain: { code: 'I', label: 'Identify Pain', score: 9 },
  champion: { code: 'C', label: 'Champion', score: 7 },
  economicBuyer: { code: 'E', label: 'Economic Buyer', score: 3 },
  decisionCriteria: { code: 'D', label: 'Decision Criteria', score: 3 },
  decisionProcess: { code: 'DP', label: 'Decision Process', score: 5 },
  metrics: { code: 'M', label: 'Metrics', score: 6 },
  competition: { code: 'CO', label: 'Competition', score: 7 },
  paperProcess: { code: 'P', label: 'Paper Process', score: 4 },
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
  initialNotes?: string;
  readOnly?: boolean;
  submitButtonText?: string;
  dimensions?: Record<string, any>;
  onBack?: () => void;
  onCancel?: () => void;
  onDraftChange?: (
    answers: Record<string, string | string[]>,
    manualNotes: string
  ) => void;
}

export function DynamicDiscoveryForm({
  dynamicForm,
  form,
  onSubmit,
  isSubmitting = false,
  isLocked = false,
  initialValues = {},
  initialNotes = '',
  readOnly = false,
  submitButtonText,
  dimensions,
  onBack,
  onCancel,
  onDraftChange,
}: DynamicDiscoveryFormProps) {
  const activeForm = form ?? dynamicForm;

  const [formData, setFormData] = useState<Record<string, string | string[]>>(initialValues);
  const [manualNotes, setManualNotes] = useState<string>(initialNotes);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      setFormData(initialValues);
    }
  }, [initialValues]);

  useEffect(() => {
    if (initialNotes !== undefined) {
      setManualNotes(initialNotes);
    }
  }, [initialNotes]);

  const handleTextChange = (fieldId: string, val: string) => {
    if (readOnly) return;
    const nextData = { ...formData, [fieldId]: val };
    setFormData(nextData);
    onDraftChange?.(nextData, manualNotes);

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
    const current = (formData[fieldId] as string[]) || [];
    const updated = current.includes(optionValue)
      ? current.filter((v) => v !== optionValue)
      : [...current, optionValue];
    const nextData = { ...formData, [fieldId]: updated };
    setFormData(nextData);
    onDraftChange?.(nextData, manualNotes);

    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleNotesChange = (val: string) => {
    if (readOnly) return;
    setManualNotes(val);
    onDraftChange?.(formData, val);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || isSubmitting || isLocked) return;

    if (!validate()) return;

    if (activeForm && activeForm.sections && activeForm.sections.length > 0) {
      if (manualNotes) {
        onSubmit(formData, manualNotes);
      } else {
        onSubmit(formData);
      }
    }
  };

  // Compute live Answered {K} of {N}
  const totalFields = activeForm && activeForm.sections
    ? activeForm.sections.reduce((acc, s) => acc + (s.fields?.length || 0), 0)
    : 0;

  const answeredCount = activeForm && activeForm.sections
    ? activeForm.sections
        .flatMap((s) => s.fields || [])
        .filter((f) => {
          const val = formData[f.id];
          if (typeof val === 'string') return val.trim().length > 0;
          if (Array.isArray(val)) return val.length > 0;
          return val !== undefined && val !== null;
        }).length
    : 0;

  const renderCalloutBanner = (section: JsonRenderSection) => {
    if (!section.calloutText) return null;

    return (
      <p className="border-l-2 border-[#D4D1C7] pl-3 font-sans text-xs text-[#52545D] leading-relaxed">
        {section.calloutText}
      </p>
    );
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id];
    const error = errors[field.id];

    const targetKey = field.dimensionTarget || '';
    const defaultMeta = TARGET_DIMENSION_DEFAULTS[targetKey] || {
      code: targetKey ? targetKey.charAt(0).toUpperCase() : 'M',
      label: targetKey || 'Dimension',
      score: 5,
    };
    const currentDimScore =
      dimensions && dimensions[targetKey]?.score !== undefined
        ? dimensions[targetKey].score
        : defaultMeta.score;

    const inputBorderClass = error
      ? 'border-[#111215] focus:border-[#111215]'
      : 'border-[#E2E0D8] hover:border-[#C8C5BA] focus:border-[#111215]';

    return (
      <div
        key={field.id}
        className="q-card py-4 border-b border-[#E2E0D8] last:border-b-0 font-sans"
      >
        {/* Desk OS Q-Card Header with Target Dimension & Embedded TenSegmentBar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-baseline gap-1.5">
            {targetKey && <span className="sr-only">{targetKey}</span>}
            <span className="font-sans text-xs font-semibold text-[#111215] tabular-nums">
              {defaultMeta.label}: {currentDimScore}/10
            </span>
          </div>

          <div className="flex items-center gap-2">
            <TenSegmentBar
              score={currentDimScore}
              compact={true}
              animateStagger={false}
              ariaLabel={`${defaultMeta.label} currently ${currentDimScore} of 10`}
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <label
              htmlFor={field.id}
              className="block font-sans text-sm font-semibold text-[#111215]"
            >
              {field.label}
              {field.required && <span className="text-[#111215] ml-0.5">*</span>}
            </label>
          </div>

          {field.description && (
            <p className="font-sans text-xs text-[#52545D] leading-relaxed">{field.description}</p>
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
              className={`w-full min-h-10 rounded-md border ${inputBorderClass} bg-[#F8F8F6] px-3.5 py-2 font-sans text-sm text-[#111215] leading-normal transition-colors focus:bg-[#FFFFFF] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#F1F0EC] disabled:text-[#636772]`}
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
              className={`w-full rounded-md border ${inputBorderClass} bg-[#F8F8F6] px-3.5 py-2 font-sans text-sm leading-relaxed text-[#111215] transition-colors focus:bg-[#FFFFFF] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#F1F0EC] disabled:text-[#636772] resize-y`}
            />
          )}

          {/* 3. Select Field */}
          {field.type === 'select' && (
            <div className="relative">
              <select
                id={field.id}
                name={field.name}
                disabled={readOnly}
                value={(value as string) || ''}
                onChange={(e) => handleTextChange(field.id, e.target.value)}
                aria-invalid={Boolean(error)}
                aria-required={field.required}
                className={`w-full min-h-10 appearance-none rounded-md border ${inputBorderClass} bg-[#F8F8F6] px-3.5 py-2 pr-10 font-sans text-sm font-normal text-[#111215] leading-normal transition-colors focus:bg-[#FFFFFF] focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:bg-[#F1F0EC] disabled:text-[#636772]`}
              >
                <option value="" disabled>
                  Select an option…
                </option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-white text-[#111215]">
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className={`pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 ${
                  readOnly ? 'text-[#636772]' : 'text-[#52545D]'
                }`}
              />
            </div>
          )}

          {/* 4. Radio Group Field */}
          {field.type === 'radio' && (
            <div className="space-y-2 pt-0.5" role="radiogroup" aria-required={field.required}>
              {field.options?.map((opt) => {
                const checked = value === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2.5 p-3 rounded-md border cursor-pointer transition ${
                      checked
                        ? 'border-[#111215] bg-[#F1F0EC] text-[#111215]'
                        : 'border-[#E2E0D8] bg-[#FFFFFF] hover:border-[#636772] text-[#52545D]'
                    } ${readOnly ? 'cursor-not-allowed bg-[#F8F8F6]' : ''}`}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={opt.value}
                      checked={checked}
                      disabled={readOnly}
                      onChange={() => handleTextChange(field.id, opt.value)}
                      className="mt-1 accent-[#111215]"
                    />
                    <div className="font-sans text-sm">
                      <div className="font-medium text-[#111215]">{opt.label}</div>
                      {opt.description && (
                        <div className="font-sans text-xs text-[#636772] mt-0.5 leading-relaxed">
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
            <div className="space-y-2 pt-0.5">
              {field.options?.map((opt) => {
                const selectedList = (value as string[]) || [];
                const checked = selectedList.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2.5 p-3 rounded-md border cursor-pointer transition ${
                      checked
                        ? 'border-[#111215] bg-[#F1F0EC] text-[#111215]'
                        : 'border-[#E2E0D8] bg-[#FFFFFF] hover:border-[#636772] text-[#52545D]'
                    } ${readOnly ? 'cursor-not-allowed bg-[#F8F8F6]' : ''}`}
                  >
                    <input
                      type="checkbox"
                      value={opt.value}
                      checked={checked}
                      disabled={readOnly}
                      onChange={() => handleCheckboxToggle(field.id, opt.value)}
                      className="mt-1 rounded accent-[#111215]"
                    />
                    <div className="font-sans text-sm">
                      <div className="font-medium text-[#111215]">{opt.label}</div>
                      {opt.description && (
                        <div className="font-sans text-xs text-[#636772] mt-0.5 leading-relaxed">
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
            <p className="mt-1.5 font-sans text-xs text-[#636772]">{field.helpCallout}</p>
          )}

          {error && <p className="font-sans text-xs text-[#111215] font-semibold mt-1">{error}</p>}
        </div>
      </div>
    );
  };

  const defaultSubmitText = 'Submit Discovery Findings & Re-Score\u00A0Deal\u00A0→';
  const effectiveSubmitText = submitButtonText || defaultSubmitText;

  return (
    <section className="bg-[#FFFFFF] font-sans">
      {/* Desk OS Stage 2 Header with Back to Audit & Answered Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4 mb-5">
        <div>
          <h2 className="font-sans text-base font-semibold tracking-tight text-[#111215]">
            {activeForm?.title || 'Field Discovery'}
          </h2>
          <p className="mt-1 font-sans text-xs text-[#636772]">
            {activeForm?.summary || 'Close the qualification blind spots identified in baseline scoring.'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className="whitespace-nowrap font-sans text-xs text-[#636772] font-medium tabular-nums"
            role="status"
            aria-live="polite"
          >
            Answered {answeredCount} of {totalFields}
          </span>

          {(onBack || onCancel) && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onBack || onCancel}
              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] transition cursor-pointer disabled:bg-[#F8F8F6] disabled:text-[#636772] disabled:cursor-not-allowed"
            >
              <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="ui-pill-label">Back to Audit</span>
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {activeForm && activeForm.sections && activeForm.sections.length > 0 ? (
          activeForm.sections.map((section) => (
            <div key={section.id} className="space-y-3.5">
              <div>
                <div className="font-sans text-xs font-semibold text-[#636772]">
                  {section.title}
                </div>
                {section.description && (
                  <p className="font-sans text-xs text-[#636772] leading-relaxed mt-1">
                    {section.description}
                  </p>
                )}
              </div>

              {renderCalloutBanner(section)}

              <div className="divide-y divide-[#E2E0D8] pt-0.5">{section.fields.map(renderField)}</div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-b border-[#E2E0D8]">
            <Info className="size-6 text-[#636772] mb-2" aria-hidden="true" />
            <p className="font-sans text-sm font-medium text-[#111215]">
              No discovery questions generated for this opportunity.
            </p>
            <p className="font-sans text-xs text-[#636772] mt-1 max-w-sm leading-relaxed">
              Discovery questions are generated automatically when qualification blind spots or stage-gate blockers are identified in the baseline audit.
            </p>
          </div>
        )}

        {!readOnly && totalFields > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#E2E0D8]">
            <label
              htmlFor="sa_manual_notes"
              className="block font-sans text-sm font-semibold text-[#111215]"
            >
              Additional SA Notes &amp; Observations <span className="text-[#636772] font-normal">(Optional)</span>
            </label>
            <textarea
              id="sa_manual_notes"
              aria-label="Additional SA Notes & Observations"
              rows={3}
              disabled={isSubmitting}
              placeholder="Document any additional customer architecture context or meeting observations…"
              value={manualNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="w-full rounded-md border border-[#E2E0D8] bg-[#F8F8F6] px-3.5 py-2 font-sans text-sm leading-relaxed text-[#111215] transition-colors hover:border-[#C8C5BA] focus:border-[#111215] focus:bg-[#FFFFFF] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#F1F0EC] disabled:text-[#636772]"
            />
          </div>
        )}

        {!readOnly && totalFields > 0 && (
          <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 border-t border-[#E2E0D8]">
            {(onCancel || onBack) && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onCancel || onBack}
                className="inline-flex min-h-9 w-full justify-center sm:w-auto items-center rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3.5 py-2 font-sans text-xs sm:text-sm font-medium leading-none text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] transition cursor-pointer disabled:bg-[#F8F8F6] disabled:text-[#636772] disabled:cursor-not-allowed"
              >
                <span className="ui-pill-label">Cancel</span>
              </button>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || isLocked}
              aria-busy={isSubmitting || undefined}
              className="min-h-9 w-full bg-[#0F52BA] text-white hover:bg-[#0C4196] sm:w-fit cursor-pointer disabled:opacity-100 disabled:bg-[#0F52BA] font-sans text-xs sm:text-sm font-semibold px-4 py-2"
            >
              {isSubmitting ? (
                <>
                  <span
                    className="inline-block size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <span>Re-scoring Deal &amp; Updating CRM…</span>
                </>
              ) : (
                <span>{effectiveSubmitText}</span>
              )}
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
