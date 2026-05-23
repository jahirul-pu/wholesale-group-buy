'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Calendar, Trash2, Plus, ArrowLeft, Loader2, Sparkles, DollarSign, Layers, Image as ImageIcon, ClipboardList, Eye, Edit3, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';

// Simple markdown-to-HTML parser for preview
function parseMarkdown(md: string) {
  if (!md) return '';
  let html = md;
  
  // Escape HTML characters
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  // Headings
  html = html.replace(/^### (.*$)/gim, '<h4 class="text-sm font-bold text-emerald-400 mt-3 mb-1">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="text-base font-bold text-emerald-400 mt-4 mb-2 border-b border-slate-800 pb-1">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="text-lg font-bold text-emerald-400 mt-5 mb-3 border-b border-slate-800 pb-1.5">$1</h2>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-950 p-3 rounded-lg border border-slate-800 my-2 font-mono text-xs text-slate-300 overflow-x-auto">$1</pre>');
  
  // Bullet lists
  html = html.replace(/^\* (.*$)/gim, '<li class="list-disc ml-5 my-1 text-slate-300">$1</li>');
  
  // Paragraphs / Line breaks (double newline to paragraph, single to br)
  html = html.split('\n\n').map(p => {
    if (p.trim().startsWith('<h') || p.trim().startsWith('<li') || p.trim().startsWith('<pre')) {
      return p;
    }
    return `<p class="my-2 leading-relaxed text-slate-300 text-xs">${p.replace(/\n/g, '<br />')}</p>`;
  }).join('\n');
  
  return html;
}

// Validation Schema using Zod
const campaignSchema = z.object({
  title: z.string().min(3, 'Campaign Title must be at least 3 characters'),
  basePrice: z.coerce.number().positive('Base Price must be a positive number'),
  targetVolume: z.coerce.number().int().positive('Target Volume must be a positive integer'),
  startImmediately: z.boolean().default(false),
  startTime: z.string().optional(),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), 'End date/time is required'),
  shortDescription: z.string().max(160, 'Short description cannot exceed 160 characters').default(''),
  richContent: z.string().default(''),
  imagesList: z.array(
    z.object({
      url: z.string().url('Please enter a valid URL').or(z.string().length(0)),
    })
  ).default([]),
  specificationsList: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ).default([]),
  tiers: z.array(
    z.object({
      targetVolume: z.coerce.number().int().positive('Volume must be a positive integer'),
      unlockedPrice: z.coerce.number().positive('Price must be a positive number'),
    })
  ).default([]),
}).superRefine((data, ctx) => {
  const start = data.startImmediately ? new Date() : new Date(data.startTime || '');
  const end = new Date(data.endTime);

  if (!data.startImmediately && (!data.startTime || isNaN(Date.parse(data.startTime)))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Start date/time is required when not starting immediately',
      path: ['startTime'],
    });
  }

  if (end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date/time must be strictly after the start date/time',
      path: ['endTime'],
    });
  }

  if (data.tiers.length > 0) {
    const sortedTiers = [...data.tiers].sort((a, b) => a.targetVolume - b.targetVolume);

    if (sortedTiers[0].unlockedPrice >= data.basePrice) {
      const idx = data.tiers.findIndex(t => t.targetVolume === sortedTiers[0].targetVolume);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Tier price ($${sortedTiers[0].unlockedPrice}) must be strictly less than the Base Price ($${data.basePrice})`,
        path: ['tiers', idx, 'unlockedPrice'],
      });
    }

    for (let i = 1; i < sortedTiers.length; i++) {
      const prev = sortedTiers[i - 1];
      const curr = sortedTiers[i];
      const currIdx = data.tiers.findIndex(t => t.targetVolume === curr.targetVolume);

      if (curr.targetVolume <= prev.targetVolume) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Volume threshold (${curr.targetVolume}) must be greater than the previous tier volume (${prev.targetVolume})`,
          path: ['tiers', currIdx, 'targetVolume'],
        });
      }

      if (curr.unlockedPrice >= prev.unlockedPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Tier price ($${curr.unlockedPrice}) must be strictly decreasing (less than $${prev.unlockedPrice})`,
          path: ['tiers', currIdx, 'unlockedPrice'],
        });
      }
    }
  }
});

export default function CreateCampaignPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Editor Tab: 'edit' | 'preview'
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      title: '',
      basePrice: undefined as any,
      targetVolume: undefined as any,
      startImmediately: false,
      startTime: '',
      endTime: '',
      shortDescription: '',
      richContent: '',
      imagesList: [] as { url: string }[],
      specificationsList: [] as { key: string; value: string }[],
      tiers: [] as any[],
    },
    mode: 'onTouched',
  });

  const { fields: tierFields, append: appendTier, remove: removeTier } = useFieldArray({
    control,
    name: 'tiers',
  });

  const { fields: imageFields, append: appendImage, remove: removeImage, swap: swapImages } = useFieldArray({
    control,
    name: 'imagesList',
  });

  const { fields: specFields, append: appendSpec, remove: removeSpec } = useFieldArray({
    control,
    name: 'specificationsList',
  });

  const startImmediately = watch('startImmediately') || false;
  const shortDescText = watch('shortDescription') || '';
  const richContentText = watch('richContent') || '';

  // Toolbar action for Markdown Editor
  const insertMarkdown = (syntax: string) => {
    const textarea = document.getElementById('richContent') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const selected = text.substring(start, end);

    let insertion = '';
    if (syntax === 'bold') insertion = `**${selected || 'bold text'}**`;
    else if (syntax === 'italic') insertion = `*${selected || 'italic text'}*`;
    else if (syntax === 'heading') insertion = `\n## ${selected || 'Heading'}\n`;
    else if (syntax === 'list') insertion = `\n* ${selected || 'List item'}\n`;

    const newVal = before + insertion + after;
    setValue('richContent', newVal);
    textarea.focus();
    
    // Set selection back
    setTimeout(() => {
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    // Bundle Specifications list into key-value object
    const specsObject: Record<string, string> = {};
    data.specificationsList?.forEach((spec: any) => {
      if (spec.key.trim() && spec.value.trim()) {
        specsObject[spec.key.trim()] = spec.value.trim();
      }
    });

    // Filter empty image URLs and map to string array
    const imageArray = data.imagesList
      ?.map((img: any) => img.url.trim())
      .filter((url: string) => url.length > 0) || [];

    const payload = {
      title: data.title,
      basePrice: data.basePrice,
      targetVolume: data.targetVolume,
      startTime: data.startImmediately ? new Date().toISOString() : new Date(data.startTime).toISOString(),
      endTime: new Date(data.endTime).toISOString(),
      shortDescription: data.shortDescription,
      richContent: data.richContent,
      images: imageArray,
      specifications: Object.keys(specsObject).length > 0 ? specsObject : null,
      tiers: [...data.tiers].sort((a, b) => a.targetVolume - b.targetVolume),
      status: data.startImmediately ? 'ACTIVE' : 'PENDING',
    };

    try {
      const res = await fetch('http://127.0.0.1:3000/api/admin/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': 'admin',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create campaign');
      }

      router.push('/admin/dashboard');
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-start py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Header action bar */}
      <div className="max-w-3xl mx-auto w-full mb-8 flex justify-between items-center">
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <span className="text-slate-500 text-xs tracking-wider uppercase font-semibold">Campaign Operations</span>
      </div>

      {/* Main card */}
      <div className="max-w-3xl mx-auto w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 w-full" />

        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Create New Group Buy (Extended)</h1>
              <p className="text-xs text-slate-400">Launch a new group buy with spec sheets, carousel galleries, and markdown pitches</p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-500/20 text-red-400 text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Section 1: Base Campaign Details */}
            <div className="space-y-6">
              <h2 className="text-sm font-semibold text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Layers className="h-4 w-4" />
                1. Core Campaign Details
              </h2>

              {/* Title Field */}
              <div className="flex flex-col gap-2">
                <label htmlFor="title" className="text-xs font-semibold text-slate-300">
                  Campaign Title
                </label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g. EcoFlow Delta Pro Max Portable Power Station"
                  {...register('title')}
                  className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                    errors.title ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
              </div>

              {/* Short Description */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="shortDescription" className="text-xs font-semibold text-slate-300">
                    Short Description (SEO / Snippet)
                  </label>
                  <span className={`text-[10px] font-mono ${shortDescText.length > 160 ? 'text-red-550' : 'text-slate-500'}`}>
                    {shortDescText.length} / 160 chars
                  </span>
                </div>
                <textarea
                  id="shortDescription"
                  rows={2}
                  maxLength={200}
                  placeholder="Summarize the product buy offer in 1-2 punchy sentences. (Used for lists, previews, and meta search tags)..."
                  {...register('shortDescription')}
                  className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none ${
                    errors.shortDescription ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
                {errors.shortDescription && <p className="text-xs text-red-500 mt-1">{errors.shortDescription.message}</p>}
              </div>

              {/* Base Price & MOQ Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Base Price */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="basePrice" className="text-xs font-semibold text-slate-300">
                    Base Price ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                    <input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      placeholder="1500.00"
                      {...register('basePrice')}
                      className={`w-full bg-slate-950 border rounded-xl pl-8 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                        errors.basePrice ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                  {errors.basePrice && <p className="text-xs text-red-500 mt-1">{errors.basePrice.message}</p>}
                </div>

                {/* Target Volume */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="targetVolume" className="text-xs font-semibold text-slate-300">
                    Target MOQ (Volume)
                  </label>
                  <input
                    id="targetVolume"
                    type="number"
                    placeholder="100"
                    {...register('targetVolume')}
                    className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                      errors.targetVolume ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'
                    }`}
                  />
                  {errors.targetVolume && <p className="text-xs text-red-500 mt-1">{errors.targetVolume.message}</p>}
                </div>
              </div>

              {/* Start Immediately Toggle */}
              <div className="flex items-center gap-2.5 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                <input
                  id="startImmediately"
                  type="checkbox"
                  {...register('startImmediately')}
                  className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20 focus:ring-offset-slate-900 focus:outline-none"
                />
                <div className="flex flex-col">
                  <label htmlFor="startImmediately" className="text-xs font-bold text-slate-200 cursor-pointer select-none">
                    Start Campaign Immediately
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Set start time to now and publish the campaign as <strong>ACTIVE</strong> immediately.
                  </span>
                </div>
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Start Date */}
                {!startImmediately ? (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="startTime" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      Start Date & Time
                    </label>
                    <input
                      id="startTime"
                      type="datetime-local"
                      {...register('startTime')}
                      className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all color-scheme-dark ${
                        errors.startTime ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'
                      }`}
                    />
                    {errors.startTime && <p className="text-xs text-red-500 mt-1">{errors.startTime.message}</p>}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 bg-slate-950/20 border border-slate-850 p-4 rounded-xl justify-center">
                    <span className="text-xs text-slate-400 block font-semibold">Start Date & Time</span>
                    <span className="text-xs text-emerald-400 font-bold">Starts immediately upon launch (Active)</span>
                  </div>
                )}

                {/* End Date */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="endTime" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    End Date & Time
                  </label>
                  <input
                    id="endTime"
                    type="datetime-local"
                    {...register('endTime')}
                    className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all color-scheme-dark ${
                      errors.endTime ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'
                    }`}
                  />
                  {errors.endTime && <p className="text-xs text-red-500 mt-1">{errors.endTime.message}</p>}
                </div>
              </div>
            </div>

            {/* Section 2: Markdown Editor for Rich Content */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Edit3 className="h-4 w-4" />
                2. Rich Pitch & Details (Markdown)
              </h2>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Editor Tabs & Controls */}
                <div className="flex justify-between items-center bg-slate-900 border-b border-slate-800 px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditorTab('edit')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        editorTab === 'edit'
                          ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Write (MD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab('preview')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        editorTab === 'preview'
                          ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Live Preview
                    </button>
                  </div>

                  {editorTab === 'edit' && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      {/* Markdown helper toolbar */}
                      <button
                        type="button"
                        onClick={() => insertMarkdown('bold')}
                        className="p-1.5 hover:bg-slate-800 hover:text-slate-200 rounded font-bold"
                        title="Bold Text"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('italic')}
                        className="p-1.5 hover:bg-slate-800 hover:text-slate-200 rounded italic"
                        title="Italic Text"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('heading')}
                        className="p-1.5 hover:bg-slate-800 hover:text-slate-200 rounded font-semibold text-[10px]"
                        title="Add Heading"
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('list')}
                        className="p-1.5 hover:bg-slate-800 hover:text-slate-200 rounded font-mono"
                        title="Add Bullet Point"
                      >
                        • List
                      </button>
                    </div>
                  )}
                </div>

                {/* Editor Content Area */}
                {editorTab === 'edit' ? (
                  <textarea
                    id="richContent"
                    rows={8}
                    placeholder="Describe the product details here in markdown. E.g.
## Super Capacity Battery
* 3600Wh massive storage
* Expandable up to 25kWh
* Recharge in 1.8 hours

Use formatting options to capture attention!"
                    {...register('richContent')}
                    className="w-full bg-transparent px-4 py-3 text-xs text-slate-100 placeholder:text-slate-700 focus:outline-none font-mono resize-y"
                  />
                ) : (
                  <div
                    className="p-4 min-h-[160px] bg-slate-950 text-slate-200 text-xs overflow-y-auto space-y-1.5 select-none"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(richContentText) || '<p class="text-slate-650 italic text-center py-6">No markdown content yet. Type in Write tab.</p>' }}
                  />
                )}
              </div>
            </div>

            {/* Section 3: Dynamic Image Gallery */}
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h2 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  3. Image Gallery Carousel Links
                </h2>
                <button
                  type="button"
                  onClick={() => appendImage({ url: '' })}
                  className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition px-3 py-1.5 rounded-lg flex items-center gap-1 border border-emerald-500/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Image URL
                </button>
              </div>

              {imageFields.length === 0 ? (
                <div className="text-center text-slate-505 text-xs py-8 border border-dashed border-slate-800 rounded-xl">
                  No images added yet. Carousel view will not render on consumer side.
                </div>
              ) : (
                <div className="space-y-4">
                  {imageFields.map((field, index) => {
                    const imgUrl = watch(`imagesList.${index}.url`);
                    const isValidUrl = imgUrl && imgUrl.startsWith('http');
                    
                    return (
                      <div key={field.id} className="flex gap-4 items-start bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                        {/* Preview thumbnail or icon */}
                        <div className="h-12 w-12 rounded-lg bg-slate-900 border border-slate-800 shrink-0 overflow-hidden flex items-center justify-center text-slate-600">
                          {isValidUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imgUrl} alt={`Thumbnail #${index + 1}`} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-5 w-5" />
                          )}
                        </div>

                        {/* URL input */}
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            Image URL #{index + 1}
                          </label>
                          <input
                            type="text"
                            placeholder="https://images.unsplash.com/photo-xxx"
                            {...register(`imagesList.${index}.url` as const)}
                            className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-750 focus:outline-none focus:ring-1 focus:ring-emerald-500/25 ${
                              errors.imagesList?.[index]?.url ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'
                            }`}
                          />
                          {errors.imagesList?.[index]?.url && (
                            <p className="text-[10px] text-red-550">{errors.imagesList[index]?.url?.message}</p>
                          )}
                        </div>

                        {/* Order Reorder / Delete Actions */}
                        <div className="flex items-center gap-1 mt-4">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => swapImages(index, index - 1)}
                            className="text-slate-500 hover:text-slate-200 transition p-1.5 disabled:opacity-30 disabled:hover:text-slate-500"
                            title="Move Up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={index === imageFields.length - 1}
                            onClick={() => swapImages(index, index + 1)}
                            className="text-slate-500 hover:text-slate-200 transition p-1.5 disabled:opacity-30 disabled:hover:text-slate-500"
                            title="Move Down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="text-slate-505 hover:text-red-400 transition p-1.5"
                            title="Delete Image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 4: Specifications Key-Values */}
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h2 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  4. Technical Specifications
                </h2>
                <button
                  type="button"
                  onClick={() => appendSpec({ key: '', value: '' })}
                  className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition px-3 py-1.5 rounded-lg flex items-center gap-1 border border-emerald-500/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Specification
                </button>
              </div>

              {specFields.length === 0 ? (
                <div className="text-center text-slate-505 text-xs py-8 border border-dashed border-slate-800 rounded-xl">
                  No technical specification rows added yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {specFields.map((field, index) => (
                    <div key={field.id} className="flex gap-4 items-center bg-slate-950/20 p-3 rounded-xl border border-slate-800/60">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                        <input
                          type="text"
                          placeholder="Specification label (e.g. Weight)"
                          {...register(`specificationsList.${index}.key` as const)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-700 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Specification value (e.g. 15 kg)"
                          {...register(`specificationsList.${index}.value` as const)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-700 focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeSpec(index)}
                        className="text-slate-500 hover:text-red-400 transition p-2 shrink-0"
                        title="Delete Spec"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 5: Dynamic Price Tiers */}
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h2 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  5. Pricing Drop Tiers (Optional)
                </h2>
                <button
                  type="button"
                  onClick={() => appendTier({ targetVolume: undefined as any, unlockedPrice: undefined as any })}
                  className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition px-3 py-1.5 rounded-lg flex items-center gap-1 border border-emerald-500/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Tier
                </button>
              </div>

              {tierFields.length === 0 ? (
                <div className="text-center text-slate-500 text-xs py-8 border border-dashed border-slate-800 rounded-xl">
                  No pricing drops added. Campaign will sell at Base Price for all volumes.
                </div>
              ) : (
                <div className="space-y-4">
                  {tierFields.map((field, index) => (
                    <div key={field.id} className="flex gap-4 items-start bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-center bg-slate-800 rounded-lg text-xs font-semibold text-slate-400 h-10 w-10 mt-1 shrink-0">
                        #{index + 1}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            Volume Threshold
                          </label>
                          <input
                            type="number"
                            placeholder="e.g. 50"
                            {...register(`tiers.${index}.targetVolume` as const)}
                            className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/25 ${
                              errors.tiers?.[index]?.targetVolume ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'
                            }`}
                          />
                          {errors.tiers?.[index]?.targetVolume && (
                            <p className="text-[10px] text-red-550">{errors.tiers[index]?.targetVolume?.message}</p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            Unlocked Price ($)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="e.g. 120.00"
                              {...register(`tiers.${index}.unlockedPrice` as const)}
                              className={`w-full bg-slate-950 border rounded-lg pl-6 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/25 ${
                                errors.tiers?.[index]?.unlockedPrice ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'
                              }`}
                            />
                          </div>
                          {errors.tiers?.[index]?.unlockedPrice && (
                            <p className="text-[10px] text-red-550">{errors.tiers[index]?.unlockedPrice?.message}</p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeTier(index)}
                        className="text-slate-500 hover:text-red-400 transition p-2 mt-4"
                        title="Delete Tier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-slate-800 flex justify-end gap-4">
              <Link
                href="/admin/dashboard"
                className="px-6 py-3 rounded-xl border border-slate-800 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition duration-200"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Launching...
                  </>
                ) : (
                  'Launch Campaign'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
