import { useState } from 'react';
import { Phone, Mail, MapPin, User, Plus, Pencil, Trash2, X, Save, Briefcase, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Patient } from '@/types';

type Priority = 'principale' | 'secondaire';

interface EmergencyContact {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  address?: string;
  email?: string;
  profession?: string;
  priority: Priority;
  remarks?: string;
}

const RELATIONS = [
  'Époux / Épouse', 'Père', 'Mère', 'Fils', 'Fille',
  'Frère', 'Sœur', 'Oncle', 'Tante', 'Grand-parent',
  'Ami(e)', 'Tuteur légal', 'Autre',
];

function buildInitialContacts(patient: Patient): EmergencyContact[] {
  if (!patient.emergencyContact) return [];
  const ec = patient.emergencyContact;
  const parts = ec.name.split(' ');
  return [{
    id: 'ec-1',
    firstName:  parts.slice(1).join(' ') || '',
    lastName:   parts[0] || '',
    relation:   ec.relation,
    phone:      ec.phone,
    address:    ec.address,
    email:      undefined,
    profession: undefined,
    priority:   'principale',
    remarks:    undefined,
  }];
}

const EMPTY_FORM: Omit<EmergencyContact, 'id'> = {
  firstName: '', lastName: '', relation: '', phone: '',
  address: '', email: '', profession: '', priority: 'secondaire', remarks: '',
};

// ─── Contact card ─────────────────────────────────────────────────────────────

function ContactCard({ contact, onEdit, onDelete }: {
  contact: EmergencyContact;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn(
      'bg-white border rounded-xl p-4 hover:border-gray-300 transition-colors group',
      contact.priority === 'principale' ? 'border-blue-200' : 'border-gray-200'
    )}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          contact.priority === 'principale' ? 'bg-blue-100' : 'bg-gray-100'
        )}>
          <User size={18} className={contact.priority === 'principale' ? 'text-blue-600' : 'text-gray-500'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              {/* Name + priority badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900">{contact.lastName} {contact.firstName}</p>
                {contact.priority === 'principale' && (
                  <span className="inline-flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                    <Star size={9} fill="currentColor" /> Principal
                  </span>
                )}
              </div>
              <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-0.5">
                {contact.relation}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                <Pencil size={13} />
              </button>
              <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Phone size={12} className="text-gray-400 flex-shrink-0" />
              <a
                href={`tel:${contact.phone.replace(/\s/g, '')}`}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
              >
                {contact.phone}
              </a>
              <a
                href={`tel:${contact.phone.replace(/\s/g, '')}`}
                className="ml-1 flex items-center gap-0.5 text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full hover:bg-green-200 transition-colors"
              >
                📞 Appeler
              </a>
            </div>
            {contact.email && (
              <p className="text-sm text-gray-600 flex items-center gap-1.5">
                <Mail size={12} className="text-gray-400" />
                <a href={`mailto:${contact.email}`} className="hover:text-blue-600 hover:underline">{contact.email}</a>
              </p>
            )}
            {contact.profession && (
              <p className="text-sm text-gray-600 flex items-center gap-1.5">
                <Briefcase size={12} className="text-gray-400" /> {contact.profession}
              </p>
            )}
            {contact.address && (
              <p className="text-sm text-gray-600 flex items-center gap-1.5">
                <MapPin size={12} className="text-gray-400" /> {contact.address}
              </p>
            )}
            {contact.remarks && (
              <p className="text-xs text-gray-400 italic mt-1">{contact.remarks}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Contact form ─────────────────────────────────────────────────────────────

function ContactForm({ initial = EMPTY_FORM, onSave, onCancel }: {
  initial?: Omit<EmergencyContact, 'id'>;
  onSave: (data: Omit<EmergencyContact, 'id'>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.firstName.trim() && form.lastName.trim() && form.relation && form.phone.trim();

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
          <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Nom" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Prénom *</label>
          <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Prénom" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Relation *</label>
          <select value={form.relation} onChange={e => set('relation', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
            <option value="">Sélectionner…</option>
            {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Téléphone *</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="05xx xx xx xx" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Email</label>
          <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="email@exemple.com" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Profession</label>
          <input value={form.profession ?? ''} onChange={e => set('profession', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Médecin, Enseignant…" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Priorité</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value as Priority)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
            <option value="principale">Principale</option>
            <option value="secondaire">Secondaire</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Adresse</label>
          <input value={form.address ?? ''} onChange={e => set('address', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Adresse complète" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">Remarques</label>
          <textarea value={form.remarks ?? ''} onChange={e => set('remarks', e.target.value)} rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            placeholder="Notes complémentaires…" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => valid && onSave(form)} disabled={!valid}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <Save size={13} /> Enregistrer
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
          <X size={13} /> Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { patient: Patient; }

export function PatientEmergencyContacts({ patient }: Props) {
  const [contacts,   setContacts]   = useState<EmergencyContact[]>(() => buildInitialContacts(patient));
  const [showAdd,    setShowAdd]    = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);

  const sorted = [...contacts].sort((a, b) => {
    if (a.priority === 'principale' && b.priority !== 'principale') return -1;
    if (b.priority === 'principale' && a.priority !== 'principale') return 1;
    return 0;
  });

  const handleAdd = (data: Omit<EmergencyContact, 'id'>) => {
    setContacts(prev => [...prev, { ...data, id: `ec-${Date.now()}` }]);
    setShowAdd(false);
  };

  const handleEdit = (id: string, data: Omit<EmergencyContact, 'id'>) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...data, id } : c));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Supprimer ce contact d\'urgence ?')) {
      setContacts(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Contacts d'urgence</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} ·{' '}
            {contacts.filter(c => c.priority === 'principale').length} principal
          </p>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={13} /> Ajouter un contact
          </button>
        )}
      </div>

      {showAdd && <ContactForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />}

      {contacts.length === 0 && !showAdd ? (
        <div className="text-center py-12 text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
          <User size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucun contact d'urgence</p>
          <p className="text-xs mt-1">Cliquez sur "Ajouter un contact" pour en enregistrer un.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(contact =>
            editingId === contact.id ? (
              <ContactForm key={contact.id} initial={contact}
                onSave={data => handleEdit(contact.id, data)}
                onCancel={() => setEditingId(null)} />
            ) : (
              <ContactCard key={contact.id} contact={contact}
                onEdit={() => setEditingId(contact.id)}
                onDelete={() => handleDelete(contact.id)} />
            )
          )}
        </div>
      )}
    </div>
  );
}
