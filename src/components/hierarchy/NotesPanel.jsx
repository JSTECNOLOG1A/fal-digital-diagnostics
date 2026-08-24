import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

/**
 * @param {Object} props
 * @param {any=} props.tenantId
 * @param {any=} props.entityType
 * @param {any=} props.entityId
 * @param {any=} props.currentUser
 */
export default function NotesPanel({ tenantId, entityType, entityId, currentUser }) {
  const queryClient = useQueryClient();
  const perms = usePermissions();
  const [text, setText] = useState('');

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', entityType, entityId],
    queryFn: () => base44.entities.Note.filter({ entity_type: entityType, entity_id: entityId }, '-created_date', 50),
    enabled: !!entityId,
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.Note.create({
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      note_text: text,
      created_by: currentUser?.email || '',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', entityType, entityId] });
      setText('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (/** @type {any} */ id) => base44.entities.Note.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes', entityType, entityId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Adicionar nota..."
          rows={2}
          className="flex-1"
        />
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!text.trim() || createMutation.isPending}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white self-end gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma nota ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="bg-slate-50 rounded-lg p-3 group">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.note_text}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-400">{note.created_by} · {note.created_date ? format(new Date(note.created_date), 'dd/MM/yyyy HH:mm') : ''}</p>
                {(currentUser?.email === note.created_by || perms.isHQ || perms.canDelete) && (
                  <button
                    onClick={() => deleteMutation.mutate(note.id)}
                    className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}