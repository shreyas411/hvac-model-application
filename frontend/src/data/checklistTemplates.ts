import { useCallback, useEffect, useState } from 'react';
import { ChecklistTemplate, JobChecklistItem } from '../types';
import { services } from '../services';

/** Admin-managed checklist items (Checklists menu), fetched on mount. */
export const useChecklistTemplates = () => {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const reload = useCallback(() => services.checklistTemplates.list().then(setTemplates).catch(() => {}), []);
  useEffect(() => { void reload(); }, [reload]);
  return { templates, setTemplates, reload };
};

export const toChecklistItems = (tpls: Pick<ChecklistTemplate, 'label' | 'category'>[]): JobChecklistItem[] =>
  tpls.map(({ label, category }) => ({ label, category, id: crypto.randomUUID(), checked: false }));
