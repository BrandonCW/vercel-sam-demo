'use client';

import React, { useState } from 'react';
import { Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JsonRenderForm, JsonRenderField } from '@/lib/ui/json-render-schema';

interface DynamicDiscoveryFormProps {
  dynamicForm: JsonRenderForm | null;
  onSubmit: (responses: Record<string, string | string[]>, notesDelta?: string) => void;
  isSubmitting?: boolean;
}

export function DynamicDiscoveryForm({
  dynamicForm,
  onSubmit,
  isSubmitting = false,
}: DynamicDiscoveryFormProps) {
  // Local form state
  const [ebAnswer, setEbAnswer] = useState('Meeting pending');
  const [criteria, setCriteria] = useState('Build speed <5m + Turborepo caching + ISR');
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});
  const [notesDelta, setNotesDelta] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dynamicForm && dynamicForm.sections.length > 0) {
      onSubmit(dynamicAnswers, notesDelta);
    } else {
      onSubmit(
        {
          economic_buyer_sponsor: ebAnswer,
          decision_criteria: criteria,
        },
        notesDelta
      );
    }
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setDynamicAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  return (
    <section className="rounded-xl border border-[#dfe5ed] bg-white shadow-xs">
      <div className="border-b border-[#e8edf3] px-5 py-5">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-[#477fb8]" aria-hidden="true" />
          <h3 className="font-semibold text-[#152238]">Targeted discovery findings</h3>
        </div>
        <p className="mt-1 text-sm text-[#718097]">
          {dynamicForm?.summary || 'Close the qualification blind spots identified in baseline scoring.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-5">
        {dynamicForm && dynamicForm.sections.length > 0 ? (
          dynamicForm.sections.map((section) => (
            <div key={section.id} className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#92a0b3]">
                {section.title}
              </h4>
              {section.fields.map((field) => (
                <RenderField
                  key={field.id}
                  field={field}
                  value={dynamicAnswers[field.name] || ''}
                  onChange={(val) => handleFieldChange(field.name, val)}
                />
              ))}
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
                onChange={(e) => setCriteria(e.target.value)}
                className="rounded-lg border border-[#dfe5ed] bg-white px-3 py-2.5 text-sm font-normal text-[#52647b] outline-none focus:ring-2 focus:ring-[#9fc2e1] cursor-pointer"
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

        <div className="pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#14233b] text-white hover:bg-[#213858] sm:w-fit cursor-pointer disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Submitting...' : 'Submit discovery findings'}</span>
            <Check className="size-4 ml-1.5" />
          </Button>
        </div>
      </form>
    </section>
  );
}

function RenderField({
  field,
  value,
  onChange,
}: {
  field: JsonRenderField;
  value: string;
  onChange: (val: string) => void;
}) {
  if (field.type === 'radio' && field.options && field.options.length > 0) {
    return (
      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-sm font-medium text-[#152238] mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </legend>
        {field.options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e8edf3] px-4 py-3 text-sm text-[#52647b] transition has-[:checked]:border-[#7aa5ce] has-[:checked]:bg-[#f0f5fb]"
          >
            <input
              type="radio"
              name={field.name}
              value={opt.value}
              checked={value === opt.value}
              onChange={(e) => onChange(e.target.value)}
              className="accent-[#14233b]"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (field.type === 'select' && field.options && field.options.length > 0) {
    return (
      <label className="flex flex-col gap-2 text-sm font-medium text-[#152238]">
        <span>
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-[#dfe5ed] bg-white px-3 py-2.5 text-sm font-normal text-[#52647b] outline-none focus:ring-2 focus:ring-[#9fc2e1] cursor-pointer"
        >
          <option value="" disabled>
            Select an option...
          </option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[#152238]">
      <span>
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ''}
        className="rounded-lg border border-[#dfe5ed] bg-white px-3 py-2.5 text-sm font-normal text-[#52647b] outline-none focus:ring-2 focus:ring-[#9fc2e1]"
      />
    </label>
  );
}
