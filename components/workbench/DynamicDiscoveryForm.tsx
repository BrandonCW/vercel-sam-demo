'use client';

import React, { useState, useEffect } from 'react';
import { Search, Check, AlertTriangle, Lightbulb, Info, HelpCircle, ArrowLeft } from 'lucide-react';
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

  // Fallback simulation state
  const [ebAnswer, setEbAnswer] = useState('Meeting pending');
  const [criteria, setCriteria] = useState('Build speed <5m + Turborepo caching + ISR');

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

    if (activeForm && activeForm.sections) {
      if (manualNotes) {
        onSubmit(formData, manualNotes);
      } else {
        onSubmit(formData);
      }
    } else {
      const fallbackData = {
        eb: ebAnswer,
        criteria: criteria,
      };
      if (manualNotes) {
        onSubmit(fallbackData, manualNotes);
      } else {
        onSubmit(fallbackData);
      }
    }
  };

  // Compute live Answered {K} of {N}
  const totalFields = activeForm && activeForm.sections
    ? activeForm.sections.reduce((acc, s) => acc + s.fields.length, 0)
    : 2;

  const answeredCount = activeForm && activeForm.sections
    ? activeForm.sections
        .flatMap((s) => s.fields)
        .filter((f) => {
          const val = formData[f.id];
          if (typeof val === 'string') return val.trim().length > 0;
          if (Array.isArray(val)) return val.length > 0;
          return val !== undefined && val !== null;
        }).length
    : (ebAnswer ? 1 : 0) + (criteria ? 1 : 0);

  const renderCalloutBanner = (section: JsonRenderSection) => {
    if (!section.calloutText) return null;

    const bannerConfig = {
      tip: {
        bg: 'bg-[#F1F0EC]',
        border: 'border-[#E2E0D8]',
        text: 'text-[#111215]',
        icon: <Lightbulb className="size-3.5 text-[#0F52BA] shrink-0" aria-hidden="true" />,
      },
      warning: {
        bg: 'bg-[#DC2626]/5',
        border: 'border-[#DC2626]/20',
        text: 'text-[#DC2626]',
        icon: <AlertTriangle className="size-3.5 text-[#DC2626] shrink-0" aria-hidden="true" />,
      },
      info: {
        bg: 'bg-[#0F52BA]/5',
        border: 'border-[#0F52BA]/20',
        text: 'text-[#0F52BA]',
        icon: <Info className="size-3.5 text-[#0F52BA] shrink-0" aria-hidden="true" />,
      },
    }[section.calloutType || 'info'];

    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs ${bannerConfig.bg} ${bannerConfig.border} ${bannerConfig.text}`}
      >
        {bannerConfig.icon}
        <span className="font-medium">{section.calloutText}</span>
      </div>
    );
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id];
    const error = errors[field.id];

    const targetKey = field.dimensionTarget || '';
    const defaultMeta = TARGET_DIMENSION_DEFAULTS[targetKey] || {
      label: targetKey || 'Dimension',
      score: 5,
    };
    const currentDimScore =
      dimensions && dimensions[targetKey]?.score !== undefined
        ? dimensions[targetKey].score
        : defaultMeta.score;

    return (
      <div
        key={field.id}
        className="q-card rounded-md border border-[#E2E0D8] bg-[#FFFFFF] shadow-2xs overflow-hidden"
      >
        {/* Desk OS Q-Card Header with Target Dimension & Embedded TenSegmentBar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E0D8] bg-[#F8F8F6] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#787C87] uppercase">
              {targetKey}
            </span>
            <span className="text-xs font-semibold text-[#111215]">
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

        <div className="p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <label
              htmlFor={field.id}
              className="block text-xs font-semibold text-[#111215]"
            >
              {field.label}
              {field.required && <span className="text-[#DC2626] ml-0.5">*</span>}
            </label>
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
      </div>
    );
  };

  const defaultSubmitText = 'Submit Discovery Findings & Re-Score Deal →';
  const effectiveSubmitText = submitButtonText || defaultSubmitText;

  return (
    <section className="rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] shadow-xs">
      {/* Desk OS Stage 2 Header with Back to Audit & Answered Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Search className="size-4 text-[#0F52BA]" aria-hidden="true" />
            <h3 className="font-semibold text-sm text-[#111215]">
              {activeForm?.title || 'Field Discovery Checklist'}
            </h3>
          </div>
          <p className="mt-1 text-xs text-[#787C87]">
            {activeForm?.summary || 'Close the qualification blind spots identified in baseline scoring.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="font-mono text-xs text-[#787C87] font-medium"
            role="status"
            aria-live="polite"
          >
            Answered {answeredCount} of {totalFields}
          </span>

          {(onBack || onCancel) && (
            <button
              type="button"
              onClick={onBack || onCancel}
              className="flex items-center gap-1 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] cursor-pointer"
            >
              <ArrowLeft className="size-3" aria-hidden="true" />
              <span>Back to Audit</span>
            </button>
          )}
        </div>
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
                    onChange={(e) => {
                      setEbAnswer(e.target.value);
                      onDraftChange?.({ ...formData, eb: e.target.value }, manualNotes);
                    }}
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
                onChange={(e) => {
                  setCriteria(e.target.value);
                  onDraftChange?.({ ...formData, criteria: e.target.value }, manualNotes);
                }}
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
              onChange={(e) => handleNotesChange(e.target.value)}
              className="w-full rounded-md border border-[#E2E0D8] bg-[#F1F0EC]/50 px-3 py-2 text-xs text-[#111215] outline-none focus:ring-1 focus:ring-[#111215] focus:bg-white"
            />
          </div>
        )}

        {!readOnly && (
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E2E0D8]">
            {(onCancel || onBack) && (
              <button
                type="button"
                onClick={onCancel || onBack}
                className="rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-2 text-xs font-medium text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] cursor-pointer"
              >
                Cancel
              </button>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || isLocked}
              aria-label={effectiveSubmitText}
              className="w-full bg-[#0F52BA] text-white hover:bg-[#0C4196] sm:w-fit cursor-pointer disabled:opacity-50 text-xs font-semibold py-2 h-auto"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                  <span>Executing Delta Re-scoring...</span>
                </>
              ) : (
                <>
                  <span>{effectiveSubmitText}</span>
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
