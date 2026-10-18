import React, { useState } from 'react';
import type { AuditEntry } from '../../services';
import { useServerPaged } from '../common/Pager';

export const AuditView: React.FC = () => {
  const [q, setQ] = useState('');
  const paged = useServerPaged<AuditEntry>('/audit', { q: q.trim() || undefined });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Audit Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">Append-only record of invoice, payment, credit and compliance actions</p>
        </div>
        <input
          type="search"
          name="q"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search entity, action, user, details…"
          aria-label="Search audit log"
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-full sm:w-72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        />
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
            <tr>
              <th scope="col" className="py-2.5 px-3">When</th>
              <th scope="col" className="py-2.5 px-3">User</th>
              <th scope="col" className="py-2.5 px-3">Entity</th>
              <th scope="col" className="py-2.5 px-3">Action</th>
              <th scope="col" className="py-2.5 px-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.rows.length === 0 && !paged.loading && <tr><td colSpan={5} className="py-4 px-3 text-center text-slate-400">No entries</td></tr>}
            {paged.rows.map((a) => (
              <tr key={a.id}>
                <td className="py-2.5 px-3 font-mono whitespace-nowrap">{new Date(a.timestamp).toLocaleString('en-GB')}</td>
                <td className="py-2.5 px-3">{a.userName}</td>
                <td className="py-2.5 px-3">{a.entity}</td>
                <td className="py-2.5 px-3 font-semibold">{a.action}</td>
                <td className="py-2.5 px-3 text-slate-600 break-words min-w-48">{a.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {paged.pager}
      </div>
    </div>
  );
};
