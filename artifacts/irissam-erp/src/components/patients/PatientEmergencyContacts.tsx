import { useState } from 'react';
import { Phone, Mail, MapPin, User, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import type { Patient } from '@/types';

interface EmergencyContact {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  address?: string;
  email?: string;
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
    firstName: parts.slice(1).join(' ') || '',
    lastName: parts[0] || '',
    relation: ec.relation,
    phone: ec.phone,
    address: ec.address,
    email: undefined,
    remarks: undefined,
  }];
}

const EMPTY_FORM: Omit<EmergencyContact, 'id'> = {
  firstName: '',
  lastName: '',
  relation: '',
  phone: '',
  address: '',
  email: '',
  remarks: '',
};

interface ContactCardProps {
  contact: EmergencyContact;
  onEdit: () => void;
  onDelete: () => void;
}

function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <User size={18} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">{contact.lastName} {contact.firstName}</p>
              <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mt-0.5">{contact.relation}</span>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                <Pencil size={13} />
              </button>
              <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <p className="text-sm text-gray-600 flex items-center gap-1.5">
              <Phone size={12} className="text-gray-400" /> {contact.phone}
            </p>
            {contact.email && (
              <p className="text-sm text-gray-600 flex items-center gap-1.5">
                <Mail size={12} className="text-gray-400" /> {contact.email}
              </p>
            )}
            {contact.address && (
              <p className="text-sm text-gray-600 flex items-center gap-1.5">
                <MapPin size={12} className="text-gray-400" /> {contact.address}
              </p>
            )}
            {contact.remarks && (
              <p className="text-xs text-gray-400 italic mt-1.5">{contact.remarks}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FormProps {
  initial?: Omit<EmergencyContact, 'id'>;
  onSave: (data: Omit<EmergencyContact, 'id'>) => void;
  onCancel: () => void;
}

function ContactForm({ initial = EMPTY_FORM, onSave, onCancel }: FormProps) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const valid = form.firstName.trim() && form.lastName.trim() && form.relation && form.phone.trim();

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
          <input
            value={form.lastName}
            onChange={e => set('lastName', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            placeholder="Nom"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Prénom *</label>
          <input
            value={form.firstName}
            onChange={e => set('firstName', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            placeholder="Prénom"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Relation *</label>
          <select
            value={form.relation}
            onChange={e => set('relation', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
          >
            <option value="">Sélectionner…</option>
            {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Téléphone *</label>
          <input
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            placeholder="05xx xx xx xx"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Adresse</label>
        <input
          value={form.address ?? ''}
          onChange={e => set('address', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          placeholder="Adresse complète"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Email</label>
        <input
          type="email"
          value={form.email ?? ''}
          onChange={e => set('email', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          placeholder="email@exemple.com"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Remarques</label>
        <textarea
          value={form.remarks ?? ''}
          onChange={e => set('remarks', e.target.value)}
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
          placeholder="Notes complémentaires…"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => valid && onSave(form)}
          disabled={!valid}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={14} /> Enregistrer
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
        >
          <X size={14} /> Annuler
        </button>
      </div>
    </div>
  );
}

interface Props {
  patient: Patient;
}

export function PatientEmergencyContacts({ patient }: Props) {
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => buildInitialContacts(patient));
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
          <p className="text-xs text-gray-500 mt-0.5">{contacts.length} contact{contacts.length !== 1 ? 's' : ''} enregistré{contacts.length !== 1 ? 's' : ''}</p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Ajouter un contact
          </button>
        )}
      </div>

      {showAdd && (
        <ContactForm
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {contacts.length === 0 && !showAdd ? (
        <div className="text-center py-12 text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
          <User size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucun contact d'urgence</p>
          <p className="text-xs mt-1">Cliquez sur "Ajouter un contact" pour en enregistrer un.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map(contact =>
            editingId === contact.id ? (
              <ContactForm
                key={contact.id}
                initial={contact}
                onSave={data => handleEdit(contact.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ContactCard
                key={contact.id}
                contact={contact}
                onEdit={() => setEditingId(contact.id)}
                onDelete={() => handleDelete(contact.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
