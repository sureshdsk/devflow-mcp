'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MarkdownPreview } from '@/components/markdown-preview';
import { useArtifact, useInvalidate } from '@/hooks/use-queries';

interface ArtifactStatus {
  id: string;
  state: 'blocked' | 'ready' | 'in_review' | 'in_progress' | 'done';
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  requires?: string[];
}

interface ArtifactEditorProps {
  specName: string;
  artifactType: string;
  content: string | null;
  status: ArtifactStatus;
  onSave: () => void;
  defaultMode?: 'edit' | 'preview';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function ArtifactEditor({
  specName,
  artifactType,
  content,
  status,
  onSave,
  defaultMode = 'edit',
}: ArtifactEditorProps) {
  const { data: artifactData, isLoading } = useArtifact(specName, artifactType);
  const { invalidateArtifact, invalidateSpec, invalidateSpecs } = useInvalidate();
  const [editContent, setEditContent] = useState(content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [preview, setPreview] = useState(defaultMode === 'preview');
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  // Sync from query data when it changes, but only if user hasn't edited locally
  useEffect(() => {
    if (artifactData?.content != null && !hasLocalEdits) {
      setEditContent(artifactData.content);
    }
  }, [artifactData, hasLocalEdits]);

  function handleContentChange(value: string) {
    setEditContent(value);
    setHasLocalEdits(true);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await fetch(`/api/specs/${specName}/artifacts/${artifactType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      setHasLocalEdits(false);
      invalidateArtifact(specName, artifactType);
      invalidateSpec(specName);
      invalidateSpecs();
      onSave();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApprove() {
    setIsApproving(true);
    try {
      await fetch(`/api/specs/${specName}/artifacts/${artifactType}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'human' }),
      });
      invalidateArtifact(specName, artifactType);
      invalidateSpec(specName);
      invalidateSpecs();
      onSave();
    } finally {
      setIsApproving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 border-4 border-gray-200 text-center">
        <p className="font-bold text-gray-500 uppercase">Loading...</p>
      </div>
    );
  }

  if (status.state === 'blocked') {
    return (
      <div className="p-6 bg-gray-100 border-4 border-gray-300 text-center">
        <p className="font-bold text-gray-600 uppercase">
          Blocked — approve required predecessors first
        </p>
        <p className="text-sm text-gray-500 mt-1">Required: {status.requires?.join(', ')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar: Edit/Preview toggle + Save + Approve */}
      <div className="flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex border-4 border-black overflow-hidden">
          <button
            onClick={() => setPreview(false)}
            className={`px-3 py-1.5 text-sm font-bold uppercase tracking-wide transition-colors ${
              !preview ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
            }`}
          >
            Edit
          </button>
          <button
            onClick={() => setPreview(true)}
            className={`px-3 py-1.5 text-sm font-bold uppercase tracking-wide border-l-4 border-black transition-colors ${
              preview ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
            }`}
          >
            Preview
          </button>
        </div>

        <div className="flex items-center gap-2">
          {status.state === 'done' && status.approvedAt && (
            <span className="text-xs font-mono text-green-700 bg-green-100 border-2 border-green-600 px-2 py-1">
              ✓ approved {relativeTime(status.approvedAt)}
            </span>
          )}
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {status.state === 'in_review' && (
            <Button
              onClick={handleApprove}
              disabled={isApproving}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white border-black"
            >
              {isApproving ? 'Approving...' : 'Approve'}
            </Button>
          )}
        </div>
      </div>

      {preview ? (
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 border-4 border-black prose prose-sm max-w-none">
          <MarkdownPreview content={editContent} />
        </div>
      ) : (
        <textarea
          className="flex-1 p-4 bg-white border-4 border-black font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black"
          value={editContent}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={`Write your ${artifactType} here...`}
        />
      )}
    </div>
  );
}
