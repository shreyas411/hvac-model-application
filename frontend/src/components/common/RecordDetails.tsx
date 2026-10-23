import React from 'react';
import { Button } from '@/src/components/ui/button';
import { CustomFieldDefinition, CustomFieldValues } from '../../types';
import { CustomFieldBox } from './CustomFields';
import { DetailDrawer } from './DetailDrawer';

/** Read-only details drawer for modules without a document view: label/value rows, then the custom fields that have a value. */
export const RecordDetails: React.FC<{
  title: React.ReactNode; description?: React.ReactNode; rows: [string, React.ReactNode][];
  defs: CustomFieldDefinition[]; values?: CustomFieldValues; onClose: () => void; onEdit?: () => void;
}> = ({ title, description, rows, defs, values, onClose, onEdit }) => (
  <DetailDrawer onClose={onClose} title={title} description={description}
    footer={<>
      <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      {onEdit && <Button size="sm" onClick={onEdit}>Edit</Button>}
    </>}>
    <div className="space-y-5 text-xs">
      <div className="space-y-1.5">
        {rows.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => <p key={k}><strong>{k}:</strong> {v}</p>)}
      </div>
      <CustomFieldBox defs={defs} values={values} />
    </div>
  </DetailDrawer>
);
