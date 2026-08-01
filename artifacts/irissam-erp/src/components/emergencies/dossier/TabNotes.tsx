import { useState } from 'react';
import { FileText, Pin, PinOff, Edit2, Check, X, PlusCircle, History, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';
import { usePermission } from '@/hooks/usePermission';
import type { ClinicalNote } from '@/types/emergencyDossier';

type NoteType = ClinicalNote['type'];

const NOTE_TYPES: { key: NoteType; label: string; color: string }[] = [
  { key: 'medical',        label: 'Médicales',      color: 'blue' },
  { key: 'nursing',        label: 'Infirmières',     color: 'teal' },
  { key: 'administratif',  label: 'Administratives', color: 'gray' },
  { key: 'transmission',   label: 'Transmissions',   color: 'purple' },
];

const NOTE_CLR: Record<string, { dot: string; badge: string; header: string; bg: string }> = {
  blue:   { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 border-blue-300',   header: 'bg-blue-50 border-blue-100',   bg: 'bg-blue-50/40' },
  teal:   { dot: 'bg-teal-500',   badge: 'bg-teal-100 text-teal-700 border-teal-300',   header: 'bg-teal-50 border-teal-100',   bg: 'bg-teal-50/40' },
  gray:   { dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600 border-gray-200',   header: 'bg-gray-50 border-gray-100',   bg: '' },
  purple: { dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 border-purple-300', header: 'bg-purple-50 border-purple-100', bg: 'bg-purple-50/40' },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Single note card ─────────────────────────────────────────────────────────

function NoteCard({ note, color }: { note: ClinicalNote; color: string }) {
  const { pinNote, editNote } = useEmergencyDossier();
  const { can } = usePermission();
  const clr = NOTE_CLR[color];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [showHistory, setShowHistory] = useState(false);

  const save = () => { editNote(note.id, draft); setEditing(false); };

  return (
    <div className={cn('border border-gray-200 rounded-xl overflow-hidden', note.isPinned ? 'ring-1 ring-amber-400' : '')}>
      <div className={cn('flex items-center gap-2 px-3 py-2 border-b', clr.header)}>
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', clr.dot)} />
        <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{note.author}</span>
        <span className="text-[10px] text-gray-400">{note.role}</span>
        <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtTime(note.createdAt)}</span>
        {note.versions && note.versions.length > 0 && (
          <button onClick={() => setShowHistory(v => !v)} className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
            <History size={9} />{note.versions.length}
            <ChevronDown size={9} className={cn('transition-transform', showHistory ? 'rotate-180' : '')} />
          </button>
        )}
        {can('emergencies.add_note') && (
          <button onClick={() => { setEditing(true); setDraft(note.content); }} className="text-gray-400 hover:text-blue-500 transition-colors">
            <Edit2 size={11} />
          </button>
        )}
        <button onClick={() => pinNote(note.id)} className={cn('transition-colors', note.isPinned ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400')}>
          {note.isPinned ? <Pin size={11} fill="currentColor" /> : <PinOff size={11} />}
        </button>
      </div>
      <div className={cn('px-4 py-3', clr.bg)}>
        {editing ? (
          <div className="space-y-2">
            <textarea
              autoFocus rows={4} value={draft} onChange={e => setDraft(e.target.value)}
              className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed"
            />
            <div className="flex gap-2">
              <button onClick={save} className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 font-semibold">
                <Check size={10} />Sauvegarder
              </button>
              <button onClick={() => { setEditing(false); setDraft(note.content); }} className="flex items-center gap-1 text-xs border border-gray-200 text-gray-600 hover:border-gray-400 rounded-lg px-3 py-1.5">
                <X size={10} />Annuler
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>
        )}
        {showHistory && note.versions && note.versions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Versions précédentes</p>
            {note.versions.map((v, i) => (
              <div key={i} className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400 mb-1">v{i + 1} — {fmtTime(v.editedAt)} par {v.editedBy}</p>
                <p className="text-gray-600 italic whitespace-pre-wrap">{v.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add note form ────────────────────────────────────────────────────────────

function AddNoteForm({ activeType, onClose }: { activeType: NoteType; onClose: () => void }) {
  const { addNote } = useEmergencyDossier();
  const [content, setContent] = useState('');
  const [type, setType] = useState<NoteType>(activeType);
  const [role, setRole] = useState('');
  const submit = () => {
    if (!content.trim()) return;
    addNote({ content, type, role: role || 'Personnel soignant' });
    onClose();
  };
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-700">Nouvelle note</p>
      <div className="flex gap-2 flex-wrap">
        {NOTE_TYPES.map(t => (
          <button key={t.key} onClick={() => setType(t.key)} className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors', type === t.key ? NOTE_CLR[t.color].badge : 'border-gray-200 text-gray-500 hover:border-gray-400')}>
            {t.label}
          </button>
        ))}
      </div>
      <input value={role} onChange={e => setRole(e.target.value)} placeholder="Qualité (optionnel)" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <textarea
        autoFocus rows={4} value={content} onChange={e => setContent(e.target.value)}
        placeholder="Rédiger la note…"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-semibold">Enregistrer</button>
        <button onClick={onClose} className="text-xs border border-gray-200 text-gray-600 hover:border-gray-400 rounded-lg px-4 py-2">Annuler</button>
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function TabNotes() {
  const { dossier } = useEmergencyDossier();
  const { can } = usePermission();
  const [activeType, setActiveType] = useState<NoteType>('medical');
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const noteMap: Record<NoteType, ClinicalNote[]> = {
    medical:       dossier.medicalNotes,
    nursing:       dossier.nursingNotes,
    administratif: dossier.adminNotes,
    transmission:  dossier.transmissions,
  };

  const currentType = NOTE_TYPES.find(t => t.key === activeType)!;
  let notes = noteMap[activeType] ?? [];
  notes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  if (search) {
    const q = search.toLowerCase();
    notes = notes.filter(n => n.content.toLowerCase().includes(q) || n.author.toLowerCase().includes(q));
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {NOTE_TYPES.map(t => {
          const count = (noteMap[t.key] ?? []).length;
          const clr = NOTE_CLR[t.color];
          return (
            <button
              key={t.key}
              onClick={() => { setActiveType(t.key); setShowAdd(false); }}
              className={cn('flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors',
                activeType === t.key ? clr.badge + ' ring-1 ring-current' : 'border-gray-200 text-gray-500 hover:border-gray-400'
              )}
            >
              <FileText size={11} />{t.label}
              {count > 0 && <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded-full', activeType === t.key ? 'bg-white/60' : 'bg-gray-100')}>{count}</span>}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-36"
          />
          {can('emergencies.add_note') && (
            <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 hover:border-blue-400 rounded-lg px-2.5 py-1.5 transition-colors">
              <PlusCircle size={12} />Note
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAdd && <AddNoteForm activeType={activeType} onClose={() => setShowAdd(false)} />}

      {/* Notes */}
      {notes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <FileText size={28} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {search ? 'Aucune note correspondante' : `Aucune note ${currentType.label.toLowerCase()}`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(n => <NoteCard key={n.id} note={n} color={currentType.color} />)}
        </div>
      )}
    </div>
  );
}
