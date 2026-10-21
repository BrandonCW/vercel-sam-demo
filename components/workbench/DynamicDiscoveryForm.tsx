'use client';

import React, { useState } from 'react';
import { Search, Check, AlertTriangle, Lightbulb, Info, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JsonRenderForm, JsonRenderSection, FormField } from '@/lib/ui/json-render-schema';

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

  const validateForm = (f: JsonRenderForm): boolean => {
    const newErrors: Record<string, string> = {};

    for (const section of f.sections) {
      for (const field of section.fields) {
        if (!field.required) continue;

        const val = formData[field.id];
        if (field.type === 'checkbox_group') {
          if (!Array.isArray(val) || val.length === 0) {
            newErrors[field.id] = `${field.label} is required. Please select at least one option.`;
          }
        } else {
          if (!val || (typeof val === 'string' && val.trim() === '')) {
            newErrors[field.id] = `${field.label} is required.`;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || isSubmitting || isLocked) return;

    if (activeForm && activeForm.sections && activeForm.sections.length > 0) {
      if (!validateForm(activeForm)) return;
      if (manualNotes.trim()) {
        await onSubmit(formData, manualNotes.trim());
      } else {
        await onSubmit(formData);
      }
    } else {
      const fallbackData = {
        economic_buyer_sponsor: ebAnswer,
        decision_criteria: criteria,
      };
      if (manualNotes.trim()) {
        await onSubmit(fallbackData, manualNotes.trim());
      } else {
        await onSubmit(fallbackData);
      }
    }
  };

  const renderCalloutBanner = (section: JsonRenderSection) => {
    if (!section.calloutText) return null;
    const type = section.calloutType || 'info';

    if (type === 'warning') {
      return (
        <div className="mb-3.5 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="leading-relaxed">{section.calloutText}</div>
        </div>
      );
    }

    if (type === 'tip') {
      return (
        <div className="mb-3.5 flex items-start gap-2.5 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
          <Lightbulb className="size-4 shrink-0 text-emerald-600 mt-0.5" />
          <div className="leading-relaxed">{section.calloutText}</div>
        </div>
      );
    }

    return (
      <div className="mb-3.5 flex items-start gap-2.5 rounded-lg border border-blue-300 bg-blue-50 p-3 text-xs text-blue-900">
        <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
        <div className="leading-relaxed">{section.calloutText}</div>
      </div>
    );
  };

  const renderField = (field: FormField) => {
    const error = errors[field.id];
    const value = formData[field.id];

    return (
      <div key={field.id} className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={field.id} className="block text-xs font-medium text-[#152238]">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <span className="text-[10px] font-mono tracking-wide text-[#718097] bg-[#f0f3f7] px-1.5 py-0.5 rounded border border-[#dfe5ed]">
            {field.dimensionTarget}
          </span>
        </div>

        {field.description && (
          <p className="text-[11px] text-[#718097] leading-relaxed">{field.description}</p>
        )}

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
            className={`w-full rounded-lg border ${
              error ? 'border-red-400 focus:ring-red-400' : 'border-[#dfe5ed] focus:ring-[#9fc2e1]'
            } bg-white px-3 py-2 text-xs text-[#152238] outline-none focus:ring-2 disabled:opacity-50`}
          />
        )}

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
            className={`w-full rounded-lg border ${
              error ? 'border-red-400 focus:ring-red-400' : 'border-[#dfe5ed] focus:ring-[#9fc2e1]'
            } bg-white px-3 py-2 text-xs text-[#152238] outline-none focus:ring-2 disabled:opacity-50 resize-y`}
          />
        )}

        {field.type === 'select' && (
          <select
            id={field.id}
            name={field.name}
            disabled={readOnly}
            value={(value as string) || ''}
            onChange={(e) => handleTextChange(field.id, e.target.value)}
            aria-invalid={Boolean(error)}
            aria-required={field.required}
            className={`w-full rounded-lg border ${
              error ? 'border-red-400 focus:ring-red-400' : 'border-[#dfe5ed] focus:ring-[#9fc2e1]'
            } bg-white px-3 py-2 text-xs text-[#152238] outline-none focus:ring-2 cursor-pointer disabled:opacity-50`}
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

        {field.type === 'radio' && (
          <div className="space-y-1.5 pt-0.5" role="radiogroup" aria-required={field.required}>
            {field.options?.map((opt) => {
              const checked = value === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                    checked
                      ? 'border-[#7aa5ce] bg-[#f0f5fb] text-[#152238]'
                      : 'border-[#e8edf3] bg-white hover:border-[#dfe5ed] text-[#52647b]'
                  } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => handleTextChange(field.id, opt.value)}
                    className="mt-0.5 accent-[#14233b]"
                  />
                  <div className="text-xs">
                    <div className="font-medium text-[#152238]">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[11px] text-[#718097] mt-0.5 leading-relaxed">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {field.type === 'checkbox_group' && (
          <div className="space-y-1.5 pt-0.5">
            {field.options?.map((opt) => {
              const selectedList = (value as string[]) || [];
              const checked = selectedList.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                    checked
                      ? 'border-[#7aa5ce] bg-[#f0f5fb] text-[#152238]'
                      : 'border-[#e8edf3] bg-white hover:border-[#dfe5ed] text-[#52647b]'
                  } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => handleCheckboxToggle(field.id, opt.value)}
                    className="mt-0.5 rounded accent-[#14233b]"
                  />
                  <div className="text-xs">
                    <div className="font-medium text-[#152238]">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[11px] text-[#718097] mt-0.5 leading-relaxed">
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
          <div className="flex items-start gap-1.5 mt-1 text-[11px] text-[#718097] bg-[#f7f9fb] px-2.5 py-1.5 rounded border border-[#dfe5ed]">
            <HelpCircle className="size-3.5 text-[#92a0b3] shrink-0 mt-0.5" />
            <span>{field.helpCallout}</span>
          </div>
        )}

        {error && <p className="text-[11px] text-red-500 font-medium mt-1">{error}</p>}
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-[#dfe5ed] bg-white shadow-xs">
      <div className="border-b border-[#e8edf3] px-5 py-5">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-[#477fb8]" aria-hidden="true" />
          <h3 className="font-semibold text-[#152238]">
            {activeForm?.title || 'Targeted discovery findings'}
          </h3>
        </div>
        <p className="mt-1 text-sm text-[#718097]">
          {activeForm?.summary || 'Close the qualification blind spots identified in baseline scoring.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-5">
        {activeForm && activeForm.sections && activeForm.sections.length > 0 ? (
          activeForm.sections.map((section) => (
            <div key={section.id} className="space-y-3.5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#92a0b3]">
                  {section.title}
                </h4>
                {section.description && (
                  <p className="text-xs text-[#718097] leading-relaxed mt-0.5">
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
              <legend className="text-sm font-medium text-[#152238] mb-1">
                Did Jane Doe (VP Engineering) formally confirm sponsorship?
              </legend>
              {[
                'Confirmed sponsorship if build times drop <5 min',
                'Meeting pending',
                'No contact yet',
              ].map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e8edf3] px-4 py-3 text-sm text-[#52647b] transition has-[:checked]:border-[#7aa5ce] has-[:checked]:bg-[#f0f5fb]"
                >
                  <input
                    type="radio"
                    name="eb"
                    value={option}
                    checked={ebAnswer === option}
                    disabled={readOnly}
                    onChange={(e) => setEbAnswer(e.target.value)}
                    className="accent-[#14233b]"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>

            <label className="flex flex-col gap-2 text-sm font-medium text-[#152238]">
              <span>Confirmed technical decision criteria:</span>
              <select
                value={criteria}
                disabled={readOnly}
                onChange={(e) => setCriteria(e.target.value)}
                className="rounded-lg border border-[#dfe5ed] bg-white px-3 py-2.5 text-sm font-normal text-[#52647b] outline-none focus:ring-2 focus:ring-[#9fc2e1] cursor-pointer disabled:opacity-50"
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
          <div className="space-y-2 pt-2 border-t border-[#e8edf3]">
            <label
              htmlFor="sa_manual_notes"
              className="block text-xs font-medium text-[#152238]"
            >
              Additional SA Notes &amp; Observations <span className="text-[#92a0b3] font-normal">(Optional)</span>
            </label>
            <textarea
              id="sa_manual_notes"
              aria-label="Additional SA Notes & Observations"
              rows={3}
              placeholder="Document any additional customer architecture context or meeting observations..."
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              className="w-full rounded-lg border border-[#dfe5ed] bg-white px-3 py-2 text-xs text-[#152238] outline-none focus:ring-2 focus:ring-[#9fc2e1]"
            />
          </div>
        )}

        {!readOnly && (
          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting || isLocked}
              aria-label="Submit Discovery Findings"
              className="w-full bg-[#14233b] text-white hover:bg-[#213858] sm:w-fit cursor-pointer disabled:opacity-50"
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
