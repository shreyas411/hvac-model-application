import { useCallback, useEffect, useState } from 'react';
import { CustomFieldDefinition, CustomFieldEntity } from '../types';
import { services } from '../services';

/** Admin-defined fields for one entity (all of them, inactive included; `active` is the subset forms and details show). */
export const useCustomFields = (entity: CustomFieldEntity | null) => {
  const [all, setAll] = useState<CustomFieldDefinition[]>([]);
  const reload = useCallback(() => services.customFields.list().then(setAll).catch(() => {}), []);
  useEffect(() => { void reload(); }, [reload]);
  const defs = all.filter((d) => d.entity === entity);
  return { all, setAll, defs, active: defs.filter((d) => !d.inactive), reload };
};
