'use client';

import React, { useState } from 'react';
import {
  JsonRenderForm,
  JsonRenderSection,
  FormField,
} from '@/lib/ui/json-render-schema';
import {
  AlertTriangle,
  Info,
  Lightbulb,
  Send,
  HelpCircle,
  Check,
} from 'lucide-react';

export interface DynamicFormRendererProps {
  form: JsonRenderForm;
  onSubmit: (
    data: Record<string, string | string[]>,
    notesDelta?: string
  ) => Promise<void> | void;
  isSubmitting?: boolean;
  initialValues?: Record<string, string | string[]>;
  readOnly?: boolean;
  submitButtonText?: string;
}

export function DynamicFormRenderer({
  form,
  onSubmit,
  isSubmitting = false,
  initialValues = {},
  readOnly = false,
  submitButtonText = 'Submit Discovery Findings & Run Delta Re-scoring',
}: DynamicFormRendererProps) {
  const [formData, setFormData] = useState<Record<string, string | string[]>>(initialValues);
  const [manualNotes, setManualNotes] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const section of form.sections) {
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
    if (readOnly || isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    if (manualNotes.trim()) {
      await onSubmit(formData, manualNotes.trim());
    } else {
      await onSubmit(formData);
    }
  };

  const renderCalloutBanner = (section: JsonRenderSection) => {
    if (!section.calloutText) return null;

    const type = section.calloutType || 'info';

    if (type === 'warning') {
      return (
        <div className="mb-4 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed font-medium">
            {section.calloutText}
          </div>
        </div>
      );
    }

    if (type === 'tip') {
      return (
        <div className="mb-4 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
          <Lightbulb className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200/90 leading-relaxed font-medium">
            {section.calloutText}
          </div>
        </div>
      );
    }

    return (
      <div className="mb-4 p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-200/90 leading-relaxed font-medium">
          {section.calloutText}
        </div>
      </div>
    );
  };

  const renderField = (field: FormField) => {
    const error = errors[field.id];
    const value = formData[field.id];

    return (
      <div key={field.id} className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label
            htmlFor={field.id}
            className="block text-xs font-semibold text-zinc-200"
          >
            {field.label}
            {field.required && (
              <span className="text-red-400 ml-1" title="Required field">
                *
              </span>
            )}
          </label>
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
            {field.dimensionTarget}
          </span>
        </div>

        {field.description && (
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {field.description}
          </p>
        )}

        {/* Input Types */}
        {field.type === 'text' && (
          <input
            id={field.id}
            name={field.name}
            type="text"
            disabled={readOnly}
            value={(value as string) || ''}
            onChange={(e) => handleTextChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            aria-invalid={Boolean(error)}
            aria-required={field.required}
            className={`w-full bg-[#18181b] border ${
              error ? 'border-red-500 focus:border-red-500' : 'border-[#27272a] focus:border-[#0070f3]'
            } rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-colors disabled:opacity-60`}
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
            placeholder={field.placeholder}
            aria-invalid={Boolean(error)}
            aria-required={field.required}
            className={`w-full bg-[#18181b] border ${
              error ? 'border-red-500 focus:border-red-500' : 'border-[#27272a] focus:border-[#0070f3]'
            } rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-colors disabled:opacity-60 resize-y`}
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
            className={`w-full bg-[#18181b] border ${
              error ? 'border-red-500 focus:border-red-500' : 'border-[#27272a] focus:border-[#0070f3]'
            } rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none transition-colors cursor-pointer disabled:opacity-60`}
          >
            <option value="" disabled className="text-zinc-500">
              Select an option...
            </option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#18181b] text-zinc-200">
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {field.type === 'radio' && (
          <div className="space-y-2 pt-1" role="radiogroup" aria-required={field.required}>
            {field.options?.map((opt) => {
              const checked = value === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? 'bg-blue-500/10 border-blue-500/50 text-white'
                      : 'bg-[#18181b] border-[#27272a] hover:border-zinc-700 text-zinc-300'
                  } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => handleTextChange(field.id, opt.value)}
                    className="mt-0.5 text-[#0070f3] focus:ring-0 bg-zinc-900 border-zinc-700"
                  />
                  <div className="text-xs">
                    <div className="font-medium text-zinc-200">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[11px] text-zinc-400 mt-0.5">
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
          <div className="space-y-2 pt-1">
            {field.options?.map((opt) => {
              const selectedList = (value as string[]) || [];
              const checked = selectedList.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? 'bg-blue-500/10 border-blue-500/50 text-white'
                      : 'bg-[#18181b] border-[#27272a] hover:border-zinc-700 text-zinc-300'
                  } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => handleCheckboxToggle(field.id, opt.value)}
                    className="mt-0.5 rounded text-[#0070f3] focus:ring-0 bg-zinc-900 border-zinc-700"
                  />
                  <div className="text-xs">
                    <div className="font-medium text-zinc-200">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* Helper Callout */}
        {field.helpCallout && (
          <div className="flex items-start gap-1.5 mt-1 text-[11px] text-blue-300/80 bg-blue-950/20 px-2 py-1 rounded border border-blue-900/30">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <span>{field.helpCallout}</span>
          </div>
        )}

        {/* Inline Error Message */}
        {error && (
          <p className="text-[11px] text-red-400 font-medium mt-1">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form Header */}
      <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm">
        <h3 className="text-base font-bold text-white tracking-tight mb-1">
          {form.title}
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {form.summary}
        </p>
      </div>

      {/* Sections */}
      {form.sections.map((section) => (
        <div
          key={section.id}
          className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm space-y-4"
        >
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight mb-1">
              {section.title}
            </h4>
            {section.description && (
              <p className="text-xs text-zinc-400 leading-relaxed">
                {section.description}
              </p>
            )}
          </div>

          {renderCalloutBanner(section)}

          <div className="space-y-4 pt-1">
            {section.fields.map(renderField)}
          </div>
        </div>
      ))}

      {/* Optional Freeform SA Observations */}
      {!readOnly && (
        <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm space-y-2">
          <label htmlFor="sa_manual_notes" className="block text-xs font-semibold text-zinc-200">
            Additional SA Notes &amp; Observations <span className="text-zinc-500 font-normal">(Optional)</span>
          </label>
          <textarea
            id="sa_manual_notes"
            rows={3}
            placeholder="Document any additional customer architecture context or meeting observations..."
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            className="w-full bg-[#18181b] border border-[#27272a] focus:border-[#0070f3] rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-colors"
          />
        </div>
      )}

      {/* Submit Action */}
      {!readOnly && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0070f3] hover:bg-[#0060df] disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Executing Delta Re-scoring...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{submitButtonText}</span>
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
}
