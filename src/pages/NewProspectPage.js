import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { API_URL } from '../config/api';

const NewProspectPage = () => {
  const navigate = useNavigate();
  const { t } = useLocale();
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: 'manual',
    status: 'new',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.full_name || !formData.phone || !formData.email || !formData.notes.trim()) {
      toast.error(t('fillAllFields') || 'Please fill all required fields');
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('kolo_token');
      const response = await fetch(`${API_URL}/api/prospects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Prospect created successfully');
        navigate('/app', { state: { tab: 'prospects' } });
      } else {
        throw new Error('Failed to create prospect');
      }
    } catch (error) {
      console.error('Create prospect error:', error);
      toast.error('Failed to create prospect');
    } finally {
      setSaving(false);
    }
  };

  const sourceOptions = [
    { value: 'manual', label: t('manual') },
    { value: 'whatsapp', label: t('whatsapp') },
    { value: 'email', label: t('emailSource') },
  ];

  const statusOptions = [
    { value: 'new', label: t('statusNew') },
    { value: 'in_progress', label: t('statusInProgress') },
    { value: 'closed', label: t('statusClosed') },
    { value: 'lost', label: t('statusLost') },
  ];

  return (
    <div className="mobile-frame">
      <div className="page-container no-nav">
        {/* Form header */}
        <div className="form-header">
          <button 
            className="cancel"
            onClick={() => navigate('/app')}
            data-testid="cancel-button"
          >
            {t('cancel')}
          </button>
          <span className="title">{t('newProspect')}</span>
          <button 
            className="save"
            onClick={handleSave}
            disabled={saving || !formData.full_name || !formData.phone || !formData.email || !formData.notes.trim()}
            data-testid="save-button"
          >
            {saving ? '...' : t('save')}
          </button>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {/* Full Name */}
          <input
            type="text"
            className="input-dark"
            placeholder={t('fullName')}
            value={formData.full_name}
            onChange={(e) => handleChange('full_name', e.target.value)}
            style={{ marginBottom: '16px' }}
            data-testid="fullname-input"
          />

          {/* Phone */}
          <input
            type="tel"
            className="input-dark"
            placeholder={t('phone')}
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            style={{ marginBottom: '16px' }}
            data-testid="phone-input"
          />

          {/* Email */}
          <input
            type="email"
            className="input-dark"
            placeholder={t('emailRequired')}
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            style={{ marginBottom: '24px' }}
            data-testid="email-input"
          />

          {/* Source */}
          <label className="text-caption" style={{ display: 'block', marginBottom: '12px' }}>
            {t('source')}
          </label>
          <div className="segmented-control" style={{ marginBottom: '24px' }}>
            {sourceOptions.map((option) => (
              <button
                key={option.value}
                className={`segment-option ${formData.source === option.value ? 'active' : ''}`}
                onClick={() => handleChange('source', option.value)}
                data-testid={`source-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Status */}
          <label className="text-caption" style={{ display: 'block', marginBottom: '12px' }}>
            {t('status')}
          </label>
          <div className="segmented-control" style={{ marginBottom: '24px' }}>
            {statusOptions.map((option) => (
              <button
                key={option.value}
                className={`segment-option ${formData.status === option.value ? 'active' : ''}`}
                onClick={() => handleChange('status', option.value)}
                data-testid={`status-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Notes - Required */}
          <label className="text-caption" style={{ display: 'block', marginBottom: '8px' }}>
            {t('addNotes')}
          </label>
          <textarea
            className="textarea-dark"
            placeholder={t('notesPlaceholder')}
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            data-testid="notes-input"
            rows={4}
            style={{ marginBottom: '16px' }}
          />
        </div>
      </div>
    </div>
  );
};

export default NewProspectPage;
